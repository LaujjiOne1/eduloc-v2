import express, { type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config';
import { OdooError } from './odoo';
import { safeEqual, verifyStripeSignature } from './security';
import { PaymentService, ServiceError } from './service';

/** Limite simple par adresse et par minute (SEC-08) : assez large pour un client normal, étroite pour un script. */
function rateLimit(limit: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) hits.set(key, { count: 1, resetAt: now + windowMs });
    else if (++entry.count > limit) {
      res.status(429).json({ error: { code: 'rate_limited', message: 'Trop de tentatives. Réessayez dans une minute.' } });
      return;
    }
    if (hits.size > 5_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    next();
  };
}

const handler = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

/**
 * Routes du service de paiement. Aucune ne reçoit de montant ni de donnée de carte : le montant vient du ticket, la carte va
 * directement du navigateur à Stripe (Stripe.js), le code secret Mobile Money ne quitte jamais le téléphone du client.
 */
export function createApp(service: PaymentService, cfg: Config, log: (m: string) => void = console.log): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière ngrok / un reverse proxy : l'adresse réelle du client

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Notification Stripe : le corps BRUT sert à vérifier la signature, donc avant tout analyseur JSON.
  app.post(
    '/api/v1/stripe/webhook',
    express.raw({ type: '*/*', limit: '1mb' }),
    handler(async (req, res) => {
      const secret = cfg.stripe?.webhookSecret ?? '';
      if (!secret || !verifyStripeSignature(req.header('stripe-signature'), req.body as Buffer, secret)) {
        res.status(400).json({ error: { code: 'signature_invalid', message: 'Signature invalide.' } });
        return;
      }
      const event = JSON.parse((req.body as Buffer).toString('utf8')) as { type: string; data?: { object?: { id?: string; metadata?: Record<string, string> } } };
      const intent = event.data?.object;
      const paymentId = intent?.metadata?.payment_id;
      if (event.type.startsWith('payment_intent.') && intent?.id && paymentId) {
        // Une erreur ici (Odoo ou Stripe indisponible) renvoie 500 : Stripe réessaie, rien n'est perdu.
        await service.syncIntent(paymentId, intent.id);
      }
      res.json({ received: true });
    }),
  );

  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, methods: { card: !!cfg.stripe, mobileMoney: !!cfg.mvola } });
  });

  const limited = rateLimit(30);

  app.post('/api/v1/checkout/session', limited, handler(async (req, res) => {
    res.json(await service.openSession(req.body?.ticket));
  }));

  app.post('/api/v1/checkout/card', limited, handler(async (req, res) => {
    res.json(await service.startCard(req.body?.ticket));
  }));

  app.post('/api/v1/checkout/mobile-money', rateLimit(8), handler(async (req, res) => {
    res.status(202).json(await service.startMobileMoney(req.body?.ticket, req.body?.operator, req.body?.phone));
  }));

  app.post('/api/v1/checkout/status', rateLimit(90), handler(async (req, res) => {
    const record = await service.statusForTicket(req.body?.ticket);
    res.json({ state: record?.state ?? 'PENDING' });
  }));

  // Rappel de l'opérateur : il ne sert qu'à déclencher une relecture du statut CHEZ l'opérateur (son corps n'est jamais cru).
  app.post('/api/v1/mobile-money/mvola/callback/:paymentId', handler(async (req, res) => {
    const id = String(req.params.paymentId);
    if (/^[0-9a-f-]{36}$/i.test(id)) await service.refreshMobileMoney(id);
    res.json({ received: true });
  }));

  // Lecture du statut par le BACKEND EduLoc (de serveur à serveur, MM-03) : clé d'API dédiée.
  app.get('/api/v1/payments/:paymentId/status', handler(async (req, res) => {
    const [scheme, token] = (req.header('authorization') ?? '').split(' ');
    if (!cfg.statusApiKey || scheme?.toLowerCase() !== 'bearer' || !safeEqual(token ?? '', cfg.statusApiKey)) {
      res.status(401).json({ error: { code: 'unauthorized', message: 'Clé d’API invalide.' } });
      return;
    }
    const id = String(req.params.paymentId);
    const record = /^[0-9a-f-]{36}$/i.test(id) ? await service.status(id) : null;
    if (!record) {
      res.status(404).json({ error: { code: 'not_found', message: 'Paiement introuvable.' } });
      return;
    }
    res.json({
      transaction_id: record.payment_id,
      state: record.state,
      verified_amount: record.state === 'SUCCEEDED' ? record.amount : undefined,
      currency: record.currency,
      verified_at: record.verified_at,
      method: record.method,
      provider: record.provider,
      provider_ref: record.provider_ref,
      card_brand: record.card_brand,
      card_last4: record.card_last4,
    });
  }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route inconnue.' } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ServiceError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof OdooError) {
      log(`CRM Odoo : ${error.message}`);
      res.status(502).json({ error: { code: 'crm_unavailable', message: 'Le service est momentanément indisponible. Réessayez dans un instant.' } });
    } else {
      log(`Erreur inattendue : ${error instanceof Error ? error.stack : String(error)}`);
      res.status(500).json({ error: { code: 'internal_error', message: 'Erreur interne.' } });
    }
  });

  return app;
}
