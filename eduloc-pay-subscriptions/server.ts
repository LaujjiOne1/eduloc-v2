/**
 * Point d'entrée du service de paiement EduLoc : une seule adresse (port 3001 par défaut) pour l'API et la page de paiement.
 *   développement : Vite en mode middleware (rechargement à chaud) ;
 *   production    : fichiers statiques de `dist/`.
 */
import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createApp } from './server/app';
import { loadConfig } from './server/config';
import { notifyEduloc } from './server/eduloc';
import { MvolaClient } from './server/mvola';
import { OdooPayments } from './server/odoo';
import { PaymentService } from './server/service';
import { StripeClient } from './server/stripe';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const stamp = (message: string) => console.log(`[pay ${new Date().toISOString()}] ${message}`);

  const service = new PaymentService({
    cfg,
    odoo: new OdooPayments(cfg.odoo),
    stripe: cfg.stripe ? new StripeClient(cfg.stripe.secretKey) : null,
    mvola: cfg.mvola ? new MvolaClient(cfg.mvola) : null,
    notify: (event, url) => notifyEduloc(event, { url, secret: cfg.webhookSecret }),
    log: stamp,
  });
  const app = createApp(service, cfg, stamp);

  if (cfg.nodeEnv === 'production') {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(dist, {
        setHeaders: (res) => {
          // Seuls Stripe.js (champs de carte hébergés) et l'API du service sont autorisés dans la page de paiement.
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; " +
              "connect-src 'self' https://api.stripe.com; img-src 'self' data: https://*.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; base-uri 'self'; form-action 'self'",
          );
        },
      }),
    );
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(cfg.port, '0.0.0.0', () => {
    stamp(`Service de paiement prêt sur http://localhost:${cfg.port} — carte : ${cfg.stripe ? 'oui' : 'non'}, MVola : ${cfg.mvola ? 'oui' : 'non'}, Odoo : ${cfg.odoo.url}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
