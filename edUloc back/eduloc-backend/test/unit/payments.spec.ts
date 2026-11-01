import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { decideTransition, toInternalStatus } from '../../src/modules/payments/domain/payment-status';
import { signTicket, verifyTicket, type TicketClaims } from '../../src/modules/payments/domain/payment-ticket';
import { sanitizeForAudit } from '../../src/modules/payments/domain/sanitize';
import {
  SIGNATURE_TOLERANCE_SECONDS, buildSignatureHeader, verifySignature,
} from '../../src/modules/payments/domain/webhook-signature';

const SECRET = 'ticket-secret-ticket-secret-ticket-0123456789';
const WEBHOOK_SECRET = 'webhook-secret-webhook-secret-webhook-012345';
const NOW = 1_800_000_000;

const claims: TicketClaims = {
  sub: '11111111-1111-4111-8111-111111111111',
  reservation_id: '22222222-2222-4222-8222-222222222222',
  amount: '47000.00',
  currency: 'MGA',
  customer_name: 'Aina Rakoto',
  customer_email: 'aina@example.mg',
  description: 'Mathématiques — Lova R.',
  return_url: 'eduloc://payment/return?payment=11111111-1111-4111-8111-111111111111',
  callback_url: 'https://api.eduloc.mg/api/payments/webhook',
};

describe('ticket de paiement (SEC-03, SEC-05)', () => {
  const { token } = signTicket(claims, { secret: SECRET, ttlSeconds: 1200, jti: 'jti-1', now: NOW });

  it('se vérifie avec le bon secret et restitue le montant figé côté serveur', () => {
    const payload = verifyTicket(token, SECRET, NOW + 60);
    assert.ok(payload);
    assert.equal(payload.amount, '47000.00');
    assert.equal(payload.reservation_id, claims.reservation_id);
    assert.equal(payload.exp, NOW + 1200);
  });

  it('refuse un autre secret, une expiration dépassée et un ticket modifié', () => {
    assert.equal(verifyTicket(token, 'un-autre-secret-un-autre-secret-0123456789', NOW + 60), null);
    assert.equal(verifyTicket(token, SECRET, NOW + 1200), null);
    const [head, body, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), amount: '1.00' })).toString('base64url');
    assert.equal(verifyTicket(`${head}.${forged}.${signature}`, SECRET, NOW + 60), null);
  });

  it('refuse l’algorithme « none » et tout algorithme autre que HS256', () => {
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = token.split('.')[1];
    assert.equal(verifyTicket(`${none}.${body}.`, SECRET, NOW + 60), null);
    const hs512 = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url');
    const sig = createHmac('sha512', SECRET).update(`${hs512}.${body}`).digest('base64url');
    assert.equal(verifyTicket(`${hs512}.${body}.${sig}`, SECRET, NOW + 60), null);
  });

  it('ne contient aucune donnée de carte ni de PIN', () => {
    const decoded = Buffer.from(token.split('.')[1], 'base64url').toString();
    assert.doesNotMatch(decoded, /cvv|pin|card_number|secret/i);
  });
});

describe('signature des notifications (SEC-05, SEC-07)', () => {
  const body = JSON.stringify({ event_id: 'evt_12345678', data: { payment_id: claims.sub, status: 'SUCCEEDED' } });

  it('accepte une notification correctement signée et récente', () => {
    const header = buildSignatureHeader(WEBHOOK_SECRET, body, NOW);
    assert.deepEqual(verifySignature(header, body, WEBHOOK_SECRET, NOW + 10), { ok: true });
  });

  it('refuse un corps modifié, un autre secret, une en-tête absente ou mal formée', () => {
    const header = buildSignatureHeader(WEBHOOK_SECRET, body, NOW);
    assert.deepEqual(verifySignature(header, body.replace('SUCCEEDED', 'FAILED'), WEBHOOK_SECRET, NOW), { ok: false, reason: 'mismatch' });
    assert.deepEqual(verifySignature(header, body, 'un-autre-secret-un-autre-secret-0123456789', NOW), { ok: false, reason: 'mismatch' });
    assert.deepEqual(verifySignature(undefined, body, WEBHOOK_SECRET, NOW), { ok: false, reason: 'missing' });
    assert.deepEqual(verifySignature('t=abc,v1=zz', body, WEBHOOK_SECRET, NOW), { ok: false, reason: 'malformed' });
  });

  it('refuse une notification rejouée après la tolérance', () => {
    const header = buildSignatureHeader(WEBHOOK_SECRET, body, NOW);
    assert.deepEqual(verifySignature(header, body, WEBHOOK_SECRET, NOW + SIGNATURE_TOLERANCE_SECONDS + 1), { ok: false, reason: 'stale' });
  });
});

describe('statuts de paiement (MM-02, VISA-04)', () => {
  it('ramène les états intermédiaires du service à PENDING : jamais un échec, jamais un succès', () => {
    for (const s of ['PENDING', 'PROCESSING', 'REQUIRES_ACTION', 'REQUIRES_PAYMENT_METHOD', 'requires_action']) {
      assert.equal(toInternalStatus(s), 'PENDING', s);
    }
    assert.equal(toInternalStatus('canceled'), 'CANCELLED');
    assert.equal(toInternalStatus('quelque chose'), null);
  });

  it('PENDING évolue vers un résultat final ; le reste ne bouge pas', () => {
    assert.deepEqual(decideTransition('PENDING', 'SUCCEEDED'), { next: 'SUCCEEDED', anomaly: false });
    assert.deepEqual(decideTransition('PENDING', 'FAILED'), { next: 'FAILED', anomaly: false });
    assert.deepEqual(decideTransition('PENDING', 'PENDING'), { next: null, anomaly: false });
    assert.deepEqual(decideTransition('FAILED', 'CANCELLED'), { next: null, anomaly: false });
    assert.deepEqual(decideTransition('FAILED', 'PENDING'), { next: null, anomaly: false });
  });

  it('SUCCEEDED est terminal, et un succès tardif est signalé comme anomalie', () => {
    assert.deepEqual(decideTransition('SUCCEEDED', 'FAILED'), { next: null, anomaly: true });
    assert.deepEqual(decideTransition('SUCCEEDED', 'PENDING'), { next: null, anomaly: false });
    assert.deepEqual(decideTransition('EXPIRED', 'SUCCEEDED'), { next: 'SUCCEEDED', anomaly: true });
    assert.deepEqual(decideTransition('FAILED', 'SUCCEEDED'), { next: 'SUCCEEDED', anomaly: true });
  });
});

describe('journal d’audit (SEC-10, VISA-02, MM-01)', () => {
  it('retire CVV, PIN, numéro de carte, jetons et signatures, à tout niveau', () => {
    const clean = sanitizeForAudit({
      status: 'SUCCEEDED',
      card_last4: '4242',
      cvv: '123',
      pin: '0000',
      card_number: '4242424242424242',
      payment_method_token: 'pm_card_xxx',
      nested: { Authorization: 'Bearer x', otp: '1234', company: 'ok' },
      list: [{ cvc: '999', brand: 'visa' }],
    }) as Record<string, unknown>;
    assert.equal(clean.status, 'SUCCEEDED');
    assert.equal(clean.card_last4, '4242');
    assert.equal(clean.cvv, '[retiré]');
    assert.equal(clean.pin, '[retiré]');
    assert.equal(clean.card_number, '[retiré]');
    assert.equal(clean.payment_method_token, '[retiré]');
    assert.deepEqual(clean.nested, { Authorization: '[retiré]', otp: '[retiré]', company: 'ok' });
    assert.deepEqual(clean.list, [{ cvc: '[retiré]', brand: 'visa' }]);
  });
});
