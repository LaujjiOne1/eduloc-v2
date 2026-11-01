import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from './app';
import type { Config } from './config';
import type { OdooPayment } from './odoo';
import { PaymentService } from './service';

const SECRET = 'ticket-secret-ticket-secret-ticket-0123456789';
const PAYMENT = '11111111-1111-4111-8111-111111111111';
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

function ticket(): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    iss: 'eduloc-api', aud: 'eduloc-pay', iat: now, exp: now + 600, jti: 'j', sub: PAYMENT, reservation_id: '22222222-2222-4222-8222-222222222222',
    amount: '47000.00', currency: 'MGA', customer_name: 'Aina', customer_email: 'a@b.mg', description: 'Maths',
    return_url: 'eduloc://payment/return?payment=1', callback_url: 'https://api.eduloc.test/hook',
  });
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}

const cfg: Config = {
  port: 0, nodeEnv: 'test', publicUrl: null, ticketSecret: SECRET, webhookSecret: 'w'.repeat(40), edulocWebhookUrl: null, statusApiKey: 'status-key-123',
  stripe: { secretKey: 'sk_test', publishableKey: 'pk_test', webhookSecret: 'whsec_test' }, odoo: { url: 'http://odoo', token: 't' }, mvola: null,
};

describe('routes HTTP du service de paiement', () => {
  const records = new Map<string, OdooPayment>();
  const synced: string[] = [];
  let base = '';
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;

  before(async () => {
    const service = new PaymentService({
      cfg,
      odoo: {
        async get(id) { return records.get(id) ?? null; },
        async upsert(p) {
          const record: OdooPayment = { payment_id: p.payment_id, reservation_id: p.reservation_id!, state: 'PENDING', amount: p.amount!, currency: p.currency!, method: null, provider: null, provider_ref: null, operator_ref: null, card_brand: null, card_last4: null, verified_at: null, has_anomaly: false };
          records.set(p.payment_id, record);
          return { status: 'created', payment: record };
        },
      },
      stripe: { async createIntent() { throw new Error('non utilisé'); }, async retrieveIntent(id) { synced.push(id); return { id, status: 'requires_payment_method', amount: 47000, amount_received: 0, currency: 'mga', metadata: { payment_id: PAYMENT } }; } },
      mvola: null,
      notify: async () => ({ ok: true, status: 200, attempts: 1 }),
    });
    server = createApp(service, cfg, () => undefined).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('ouvre une session avec un ticket valide et refuse un ticket invalide', async () => {
    const ok = await post('/api/v1/checkout/session', { ticket: ticket() });
    assert.equal(ok.status, 200);
    const session = (await ok.json()) as { payment: { amount: string }; methods: { visa: unknown; mobileMoney: string[] } };
    assert.equal(session.payment.amount, '47000.00');
    assert.deepEqual(session.methods.mobileMoney, []);
    assert.equal(ok.headers.get('cache-control'), 'no-store');

    const bad = await post('/api/v1/checkout/session', { ticket: 'faux' });
    assert.equal(bad.status, 401);
    assert.equal(((await bad.json()) as { error: { code: string } }).error.code, 'ticket_invalid');
  });

  it('refuse Mobile Money quand aucun opérateur n’est configuré', async () => {
    const response = await post('/api/v1/checkout/mobile-money', { ticket: ticket(), operator: 'mvola', phone: '0341234567' });
    assert.equal(response.status, 503);
  });

  it('exige la clé d’API du backend EduLoc pour lire un statut', async () => {
    assert.equal((await fetch(`${base}/api/v1/payments/${PAYMENT}/status`)).status, 401);
    assert.equal((await fetch(`${base}/api/v1/payments/${PAYMENT}/status`, { headers: { Authorization: 'Bearer faux' } })).status, 401);
    const ok = await fetch(`${base}/api/v1/payments/${PAYMENT}/status`, { headers: { Authorization: 'Bearer status-key-123' } });
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as { state: string }).state, 'PENDING');
    assert.equal((await fetch(`${base}/api/v1/payments/99999999-9999-4999-8999-999999999999/status`, { headers: { Authorization: 'Bearer status-key-123' } })).status, 404);
  });

  it('rejette un webhook Stripe sans signature valide et relit le PaymentIntent chez Stripe sur un webhook signé', async () => {
    const body = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1', metadata: { payment_id: PAYMENT } } } });
    assert.equal((await post('/api/v1/stripe/webhook', body)).status, 400);
    assert.equal((await post('/api/v1/stripe/webhook', body, { 'Stripe-Signature': 't=1,v1=' + '0'.repeat(64) })).status, 400);

    const t = Math.floor(Date.now() / 1000);
    const signature = `t=${t},v1=${createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex')}`;
    const ok = await post('/api/v1/stripe/webhook', body, { 'Stripe-Signature': signature });
    assert.equal(ok.status, 200);
    assert.deepEqual(synced, ['pi_1'], 'le corps du webhook n’est jamais cru : Stripe est relu');
  });

  it('répond 404 JSON aux routes inconnues de l’API', async () => {
    const response = await fetch(`${base}/api/v1/inconnue`);
    assert.equal(response.status, 404);
  });
});
