/**
 * Configuration du service de paiement. Tout vient de l'environnement (jamais du dépôt, jamais du navigateur : SEC-02).
 *
 * Le service n'a NI base de données NI stockage local : chaque paiement est enregistré dans le CRM Odoo (module
 * eduloc_payments). Sans Odoo configuré il refuse de démarrer.
 */
export interface Config {
  port: number;
  nodeEnv: string;
  /** Adresse publique du service (ngrok en développement) : sert aux retours des opérateurs Mobile Money. */
  publicUrl: string | null;
  /** Secret des tickets émis par le backend EduLoc (HS256). */
  ticketSecret: string;
  /** Secret de signature des notifications envoyées à EduLoc. */
  webhookSecret: string;
  /** Où notifier EduLoc. À défaut, le `callback_url` du ticket (signé par EduLoc, donc de confiance). */
  edulocWebhookUrl: string | null;
  /** Clé que le backend EduLoc présente pour lire un statut (`PAY_API_KEY` côté backend). */
  statusApiKey: string;
  stripe: { secretKey: string; publishableKey: string; webhookSecret: string } | null;
  odoo: { url: string; token: string };
  mvola: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    merchantMsisdn: string;
    partnerName: string;
  } | null;
}

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v ?? '').trim();
const url = (v: string | undefined) => clean(v).replace(/\/+$/, '');

export function loadConfig(env: Env = process.env): Config {
  const problems: string[] = [];
  const ticketSecret = clean(env.PAY_TICKET_SECRET);
  const webhookSecret = clean(env.PAY_WEBHOOK_SECRET);
  if (ticketSecret.length < 32) problems.push('PAY_TICKET_SECRET (>= 32 caractères) est requis.');
  if (webhookSecret.length < 32) problems.push('PAY_WEBHOOK_SECRET (>= 32 caractères) est requis.');
  if (ticketSecret && ticketSecret === webhookSecret) problems.push('PAY_TICKET_SECRET et PAY_WEBHOOK_SECRET doivent différer.');

  const odooUrl = url(env.ODOO_URL);
  const odooToken = clean(env.ODOO_PAYMENTS_TOKEN);
  if (!odooUrl || !odooToken) {
    problems.push('ODOO_URL et ODOO_PAYMENTS_TOKEN sont requis : les paiements ne sont enregistrés que dans le CRM Odoo.');
  }

  const nodeEnv = clean(env.NODE_ENV) || 'development';
  const publicUrl = url(env.PAY_SERVICE_PUBLIC_URL) || null;
  if (nodeEnv === 'production' && publicUrl && !publicUrl.startsWith('https://')) {
    problems.push('PAY_SERVICE_PUBLIC_URL doit être en HTTPS en production (SEC-01).');
  }
  const edulocWebhookUrl = url(env.EDULOC_WEBHOOK_URL) || null;
  if (nodeEnv === 'production' && edulocWebhookUrl && !edulocWebhookUrl.startsWith('https://')) {
    problems.push('EDULOC_WEBHOOK_URL doit être en HTTPS en production (SEC-01).');
  }

  if (problems.length) throw new Error(`Configuration invalide :\n - ${problems.join('\n - ')}`);

  const stripe = clean(env.STRIPE_SECRET_KEY)
    ? {
        secretKey: clean(env.STRIPE_SECRET_KEY),
        publishableKey: clean(env.STRIPE_PUBLISHABLE_KEY),
        webhookSecret: clean(env.STRIPE_WEBHOOK_SECRET),
      }
    : null;
  if (stripe && (!stripe.publishableKey || !stripe.webhookSecret)) {
    throw new Error('STRIPE_SECRET_KEY exige STRIPE_PUBLISHABLE_KEY et STRIPE_WEBHOOK_SECRET.');
  }
  if (stripe && nodeEnv === 'production' && !stripe.secretKey.startsWith('sk_live_')) {
    // Pas une erreur : un environnement de pré-production peut garder les clés de test. On le signale seulement au démarrage.
  }

  const mvola = clean(env.MVOLA_CLIENT_ID)
    ? {
        baseUrl: url(env.MVOLA_BASE_URL) || 'https://devapi.mvola.mg',
        clientId: clean(env.MVOLA_CLIENT_ID),
        clientSecret: clean(env.MVOLA_CLIENT_SECRET),
        merchantMsisdn: clean(env.MVOLA_MERCHANT_MSISDN),
        partnerName: clean(env.MVOLA_PARTNER_NAME) || 'EduLoc',
      }
    : null;
  if (mvola && (!mvola.clientSecret || !mvola.merchantMsisdn)) {
    throw new Error('MVOLA_CLIENT_ID exige MVOLA_CLIENT_SECRET et MVOLA_MERCHANT_MSISDN.');
  }

  return {
    port: Number(env.PORT) || 3001,
    nodeEnv,
    publicUrl,
    ticketSecret,
    webhookSecret,
    edulocWebhookUrl,
    statusApiKey: clean(env.PAY_STATUS_API_KEY),
    stripe,
    odoo: { url: odooUrl, token: odooToken },
    mvola,
  };
}
