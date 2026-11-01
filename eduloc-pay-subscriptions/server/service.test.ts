import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import type { Config } from './config';
import type { EdulocEvent } from './eduloc';
import type { OdooPayment, OdooUpsert, UpsertResult } from './odoo';
import { PaymentService, ServiceError, type Deps } from './service';
import type { StripeIntent } from './stripe';

const SECRET = 'ticket-secret-ticket-secret-ticket-0123456789';
const PAYMENT = '11111111-1111-4111-8111-111111111111';
const RESERVATION = '22222222-2222-4222-8222-222222222222';
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

function ticket(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'eduloc-api', aud: 'eduloc-pay', iat: now, exp: now + 1200, jti: 'jti-1', sub: PAYMENT, reservation_id: RESERVATION,
    amount: '47000.00', currency: 'MGA', customer_name: 'Aina', customer_email: 'aina@example.mg', description: 'Maths',
    return_url: 'eduloc://payment/return?payment=1', callback_url: 'https://api.eduloc.test/api/payments/webhook', ...overrides,
  };
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}

/** Odoo en mémoire, avec les mêmes règles que le module eduloc_payments (incohérence refusée, succès terminal, rejeu ignoré). */
class FakeOdoo {
  records = new Map<string, OdooPayment>();
  seen = new Set<string>();
  upserts: OdooUpsert[] = [];

  async get(id: string) {
    return this.records.get(id) ?? null;
  }

  async upsert(p: OdooUpsert): Promise<UpsertResult> {
    this.upserts.push(p);
    let record = this.records.get(p.payment_id);
    if (this.seen.has(p.event_id)) return { status: 'duplicate', payment: record ?? null };
    this.seen.add(p.event_id);
    if (!record) {
      record = {
        payment_id: p.payment_id, reservation_id: p.reservation_id!, state: 'PENDING', amount: p.amount!, currency: p.currency!, method: p.method ?? null,
        provider: p.provider ?? null, provider_ref: p.provider_ref ?? null, operator_ref: p.operator_ref ?? null, card_brand: null, card_last4: null, verified_at: null, has_anomaly: false,
      };
      this.records.set(p.payment_id, record);
      return { status: 'created', payment: { ...record } };
    }
    if ((p.amount && Number(p.amount) !== Number(record.amount)) || (p.currency && p.currency !== record.currency)) {
      record.has_anomaly = true;
      return { status: 'rejected', reason: 'montant différent', payment: { ...record } };
    }
    const next = String(p.status).toUpperCase() as OdooPayment['state'];
    const before = record.state;
    if (record.state === 'PENDING' && next !== 'PENDING') record.state = next;
    Object.assign(record, {
      method: p.method ?? record.method, provider: p.provider ?? record.provider, provider_ref: p.provider_ref ?? record.provider_ref,
      operator_ref: p.operator_ref ?? record.operator_ref, card_brand: p.card_brand ?? record.card_brand, card_last4: p.card_last4 ?? record.card_last4,
    });
    return { status: before === record.state ? 'unchanged' : 'updated', payment: { ...record } };
  }
}

const baseCfg: Config = {
  port: 3001, nodeEnv: 'test', publicUrl: 'https://pay.test', ticketSecret: SECRET, webhookSecret: 'w'.repeat(40), edulocWebhookUrl: null, statusApiKey: 'k',
  stripe: { secretKey: 'sk_test', publishableKey: 'pk_test', webhookSecret: 'whsec' }, odoo: { url: 'http://odoo', token: 't' },
  mvola: { baseUrl: 'x', clientId: 'c', clientSecret: 's', merchantMsisdn: '0343500004', partnerName: 'EduLoc' },
};

function setup(overrides: Partial<Deps> = {}) {
  const odoo = new FakeOdoo();
  const notified: { event: EdulocEvent; url: string }[] = [];
  const intents: Record<string, StripeIntent> = {};
  const created: Record<string, unknown>[] = [];
  const deps: Deps = {
    cfg: baseCfg,
    odoo,
    stripe: {
      async createIntent(args) {
        created.push(args);
        const intent: StripeIntent = { id: 'pi_1', status: 'requires_payment_method', amount: args.amount, amount_received: 0, currency: args.currency.toLowerCase(), client_secret: 'pi_1_secret', metadata: { payment_id: args.paymentId, reservation_id: args.reservationId } };
        intents.pi_1 ??= intent;
        return intents.pi_1;
      },
      async retrieveIntent(id) {
        return intents[id];
      },
    },
    mvola: {
      async requestPayment() {
        return { correlationId: 'corr-1' };
      },
      async status() {
        return { state: 'SUCCEEDED', transactionRef: 'MV123', verifiedAmount: '47000.00', currency: 'MGA' };
      },
    },
    notify: async (event, url) => (notified.push({ event, url }), { ok: true, status: 200, attempts: 1 }),
    ...overrides,
  };
  return { service: new PaymentService(deps), odoo, notified, intents, created };
}

const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: unknown) => (e instanceof ServiceError ? e.code : String(e)));

describe('ouverture de la page de paiement', () => {
  it('refuse un ticket invalide et une adresse de retour étrangère à l’application', async () => {
    const { service } = setup();
    assert.equal(await code(service.openSession('nimporte')), 'ticket_invalid');
    assert.equal(await code(service.openSession(ticket({ return_url: 'https://evil.example/steal' }))), 'ticket_invalid');
  });

  it('enregistre le paiement dans Odoo avec le montant DU TICKET, et annonce les moyens réellement disponibles', async () => {
    const { service, odoo } = setup();
    const session = await service.openSession(ticket());
    assert.equal(session.payment.amount, '47000.00');
    assert.deepEqual(session.methods, { visa: { publishableKey: 'pk_test' }, mobileMoney: ['mvola'] });
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
    // Rouvrir la page ne crée rien de plus.
    await service.openSession(ticket());
    assert.equal(odoo.upserts.filter((u) => u.event_id.startsWith('opened:')).length, 1);
  });

  it('refuse un ticket dont le montant diffère de ce qu’Odoo a enregistré', async () => {
    const { service } = setup();
    await service.openSession(ticket());
    assert.equal(await code(service.openSession(ticket({ amount: '1.00' }))), 'ticket_mismatch');
  });

  it('masque un moyen non configuré', async () => {
    const { service } = setup({ stripe: null, mvola: null });
    assert.deepEqual((await service.openSession(ticket())).methods, { visa: null, mobileMoney: [] });
  });
});

describe('carte (Stripe)', () => {
  it('crée le PaymentIntent avec le montant du ticket, sans jamais voir de donnée de carte', async () => {
    const { service, created } = setup();
    const started = await service.startCard(ticket());
    assert.deepEqual(started, { clientSecret: 'pi_1_secret', publishableKey: 'pk_test' });
    assert.equal(created[0].amount, 47000);
    assert.equal(created[0].currency, 'MGA');
  });

  it('un succès Stripe vérifié est enregistré puis notifié à EduLoc, une seule fois', async () => {
    const { service, odoo, notified, intents } = setup();
    await service.startCard(ticket());
    intents.pi_1 = { ...intents.pi_1, status: 'succeeded', amount_received: 47000, latest_charge: { payment_method_details: { card: { brand: 'visa', last4: '4242' } } } };

    await service.syncIntent(PAYMENT, 'pi_1', 'https://api.eduloc.test/api/payments/webhook');
    await service.syncIntent(PAYMENT, 'pi_1', 'https://api.eduloc.test/api/payments/webhook');

    assert.equal(odoo.records.get(PAYMENT)?.state, 'SUCCEEDED');
    assert.equal(notified.length, 1);
    assert.equal(notified[0].url, 'https://api.eduloc.test/api/payments/webhook');
    assert.deepEqual(
      { status: notified[0].event.data.status, amount: notified[0].event.data.amount, brand: notified[0].event.data.card_brand, last4: notified[0].event.data.card_last4 },
      { status: 'SUCCEEDED', amount: '47000.00', brand: 'visa', last4: '4242' },
    );
    assert.doesNotMatch(JSON.stringify(notified[0].event), /cvv|number|secret/i);
  });

  it('une adresse de notification configurée prime sur celle du ticket', async () => {
    const { service, notified, intents } = setup({ cfg: { ...baseCfg, edulocWebhookUrl: 'https://ngrok.test/api/payments/webhook' } });
    await service.startCard(ticket());
    intents.pi_1 = { ...intents.pi_1, status: 'succeeded', amount_received: 47000 };
    await service.syncIntent(PAYMENT, 'pi_1', 'https://ticket.example/hook');
    assert.equal(notified[0].url, 'https://ngrok.test/api/payments/webhook');
  });

  it('un succès Stripe au montant différent n’est PAS validé ni notifié', async () => {
    const { service, odoo, notified, intents } = setup();
    await service.startCard(ticket());
    intents.pi_1 = { ...intents.pi_1, status: 'succeeded', amount_received: 1000, amount: 47000 };
    await service.syncIntent(PAYMENT, 'pi_1', 'https://api.eduloc.test/api/payments/webhook');
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
    assert.equal(odoo.records.get(PAYMENT)?.has_anomaly, true);
    assert.equal(notified.length, 0);
  });

  it('un refus de carte reste « en cours » (le client peut réessayer) ; l’annulation est finale', async () => {
    const { service, odoo, notified, intents } = setup();
    await service.startCard(ticket());
    intents.pi_1 = { ...intents.pi_1, status: 'requires_payment_method', last_payment_error: { message: 'Carte refusée' } };
    await service.syncIntent(PAYMENT, 'pi_1');
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
    assert.equal(notified.length, 0);
    intents.pi_1 = { ...intents.pi_1, status: 'canceled' };
    await service.syncIntent(PAYMENT, 'pi_1', 'https://api.eduloc.test/hook');
    assert.equal(odoo.records.get(PAYMENT)?.state, 'CANCELLED');
    assert.equal(notified[0].event.data.status, 'CANCELLED');
  });

  it('ignore un PaymentIntent qui n’appartient pas à ce paiement', async () => {
    const { service, odoo, intents, notified } = setup();
    await service.startCard(ticket());
    intents.pi_1 = { ...intents.pi_1, status: 'succeeded', amount_received: 47000, metadata: { payment_id: '99999999-9999-4999-8999-999999999999' } };
    await service.syncIntent(PAYMENT, 'pi_1', 'u');
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
    assert.equal(notified.length, 0);
  });
});

describe('Mobile Money (MVola)', () => {
  it('une demande acceptée reste « en cours » et le numéro n’est jamais conservé', async () => {
    const { service, odoo } = setup();
    assert.deepEqual(await service.startMobileMoney(ticket(), 'mvola', '034 12 345 67'), { state: 'PENDING' });
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
    assert.equal(odoo.records.get(PAYMENT)?.operator_ref, 'corr-1');
    assert.doesNotMatch(JSON.stringify(odoo.upserts), /0341234567|034 12 345 67/);
  });

  it('ne renvoie pas une seconde demande vers le téléphone', async () => {
    let requests = 0;
    const { service } = setup({ mvola: { async requestPayment() { requests += 1; return { correlationId: 'corr-1' }; }, async status() { return { state: 'PENDING', transactionRef: null, verifiedAmount: null, currency: null }; } } });
    await service.startMobileMoney(ticket(), 'mvola', '0341234567');
    await service.startMobileMoney(ticket(), 'mvola', '0341234567');
    assert.equal(requests, 1);
  });

  it('refuse un numéro invalide, un opérateur inconnu', async () => {
    const { service } = setup();
    assert.equal(await code(service.startMobileMoney(ticket(), 'mvola', '12')), 'invalid_phone');
    assert.equal(await code(service.startMobileMoney(ticket(), 'orange-money', '0341234567')), 'method_unavailable');
  });

  it('valide sur le résultat constaté chez l’opérateur, puis notifie EduLoc', async () => {
    const { service, odoo, notified } = setup();
    await service.startMobileMoney(ticket(), 'mvola', '0341234567');
    const record = await service.status(PAYMENT, 'https://api.eduloc.test/hook');
    assert.equal(record?.state, 'SUCCEEDED');
    assert.equal(odoo.records.get(PAYMENT)?.provider_ref, 'MV123');
    assert.equal(notified.length, 1);
    assert.equal(notified[0].event.data.method, 'mobile_money');
  });

  it('un montant constaté différent chez l’opérateur n’est pas validé', async () => {
    const { service, odoo, notified } = setup({
      mvola: { async requestPayment() { return { correlationId: 'corr-1' }; }, async status() { return { state: 'SUCCEEDED', transactionRef: 'MV1', verifiedAmount: '100.00', currency: 'MGA' }; } },
    });
    await service.startMobileMoney(ticket(), 'mvola', '0341234567');
    await service.status(PAYMENT, 'u');
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
    assert.equal(notified.length, 0);
  });

  it('un échec opérateur est notifié comme FAILED', async () => {
    const { service, notified } = setup({
      mvola: { async requestPayment() { return { correlationId: 'c' }; }, async status() { return { state: 'FAILED', transactionRef: null, verifiedAmount: null, currency: null }; } },
    });
    await service.startMobileMoney(ticket(), 'mvola', '0341234567');
    await service.status(PAYMENT, 'u');
    assert.equal(notified[0].event.data.status, 'FAILED');
  });
});

describe('statut', () => {
  it('un opérateur ou Stripe injoignable ne transforme jamais un paiement en échec (MM-02)', async () => {
    const { service, odoo } = setup({ mvola: { async requestPayment() { return { correlationId: 'c' }; }, async status() { throw new Error('coupé'); } } });
    await service.startMobileMoney(ticket(), 'mvola', '0341234567');
    assert.equal((await service.status(PAYMENT))?.state, 'PENDING');
    assert.equal(odoo.records.get(PAYMENT)?.state, 'PENDING');
  });

  it('inconnu dans Odoo = null', async () => {
    const { service } = setup();
    assert.equal(await service.status('99999999-9999-4999-8999-999999999999'), null);
  });
});
