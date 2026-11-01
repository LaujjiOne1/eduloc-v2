import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { notifyEduloc } from './eduloc';
import { signatureHeader, verifyStripeSignature, verifyTicket } from './security';

const SECRET = 'ticket-secret-ticket-secret-ticket-0123456789';
const NOW = 1_800_000_000;
const b64 = (v: unknown) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/** Même fabrication que le backend EduLoc (edUloc back/eduloc-backend/src/modules/payments/domain/payment-ticket.ts). */
function makeTicket(overrides: Record<string, unknown> = {}, secret = SECRET, alg = 'HS256') {
  const payload = {
    iss: 'eduloc-api', aud: 'eduloc-pay', iat: NOW, exp: NOW + 1200, jti: 'jti-1',
    sub: '11111111-1111-4111-8111-111111111111', reservation_id: '22222222-2222-4222-8222-222222222222',
    amount: '47000.00', currency: 'MGA', customer_name: 'Aina Rakoto', customer_email: 'aina@example.mg',
    description: 'Mathématiques — Lova R.', return_url: 'eduloc://payment/return?payment=1', callback_url: 'https://api.eduloc.test/api/payments/webhook',
    ...overrides,
  };
  const head = b64({ alg, typ: 'JWT' });
  const body = b64(payload);
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}

describe('ticket EduLoc (SEC-03, SEC-05)', () => {
  it('accepte un ticket valide', () => {
    const ticket = verifyTicket(makeTicket(), SECRET, NOW + 10);
    assert.equal(ticket?.amount, '47000.00');
    assert.equal(ticket?.sub, '11111111-1111-4111-8111-111111111111');
  });

  it('refuse un autre secret, un ticket expiré, modifié, sans montant valide ou mal formé', () => {
    assert.equal(verifyTicket(makeTicket({}, 'un-autre-secret-un-autre-secret-0123456789'), SECRET, NOW + 10), null);
    assert.equal(verifyTicket(makeTicket(), SECRET, NOW + 1200), null);
    const [head, , signature] = makeTicket().split('.');
    assert.equal(verifyTicket(`${head}.${b64({ amount: '1.00' })}.${signature}`, SECRET, NOW + 10), null);
    assert.equal(verifyTicket(makeTicket({ amount: '0' }), SECRET, NOW + 10), null);
    assert.equal(verifyTicket(makeTicket({ currency: 'mga' }), SECRET, NOW + 10), null);
    assert.equal(verifyTicket(makeTicket({ sub: 'pas-un-uuid' }), SECRET, NOW + 10), null);
    assert.equal(verifyTicket(makeTicket({ aud: 'autre' }), SECRET, NOW + 10), null);
    assert.equal(verifyTicket('abc', SECRET), null);
    assert.equal(verifyTicket(undefined, SECRET), null);
  });

  it('refuse « none » et tout algorithme autre que HS256', () => {
    assert.equal(verifyTicket(`${b64({ alg: 'none' })}.${makeTicket().split('.')[1]}.`, SECRET, NOW + 10), null);
    assert.equal(verifyTicket(makeTicket({}, SECRET, 'HS512'), SECRET, NOW + 10), null);
  });
});

describe('signature Stripe', () => {
  const secret = 'whsec_test_secret';
  const body = Buffer.from('{"id":"evt_1"}');
  const header = (t: number, key = secret) => `t=${t},v1=${createHmac('sha256', key).update(`${t}.`).update(body).digest('hex')}`;

  it('accepte une signature correcte et récente', () => assert.equal(verifyStripeSignature(header(NOW), body, secret, NOW + 5), true));
  it('refuse corps modifié, mauvais secret, rejeu tardif et en-têtes absents ou mal formés', () => {
    assert.equal(verifyStripeSignature(header(NOW), Buffer.from('{"id":"evt_2"}'), secret, NOW), false);
    assert.equal(verifyStripeSignature(header(NOW, 'autre'), body, secret, NOW), false);
    assert.equal(verifyStripeSignature(header(NOW), body, secret, NOW + 301), false);
    assert.equal(verifyStripeSignature(undefined, body, secret, NOW), false);
    assert.equal(verifyStripeSignature('t=abc,v1=zz', body, secret, NOW), false);
    assert.equal(verifyStripeSignature(header(NOW), body, '', NOW), false);
  });
});

describe('notification signée vers EduLoc (SEC-05, SEC-07)', () => {
  const event = { event_id: 'pay:1:SUCCEEDED:pi_1', type: 'payment.updated' as const, data: { payment_id: 'p', reservation_id: 'r', status: 'SUCCEEDED', amount: '47000.00', currency: 'MGA' } };
  const noSleep = async () => undefined;

  it('signe le corps exact envoyé, avec le contrat d’EduLoc', async () => {
    let seen: { body: string; signature: string } | null = null;
    const http = (async (_url: string, init: RequestInit) => {
      seen = { body: String(init.body), signature: (init.headers as Record<string, string>)['X-Eduloc-Pay-Signature'] };
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const result = await notifyEduloc(event, { url: 'https://api.eduloc.test/hook', secret: 'webhook-secret-webhook-secret-webhook-012345', http, sleep: noSleep, now: () => NOW * 1000 });
    assert.deepEqual({ ok: result.ok, attempts: result.attempts }, { ok: true, attempts: 1 });
    assert.equal(seen!.signature, signatureHeader('webhook-secret-webhook-secret-webhook-012345', seen!.body, NOW));
    assert.equal(JSON.parse(seen!.body).event_id, 'pay:1:SUCCEEDED:pi_1');
  });

  it('réessaie sur 5xx et erreur réseau avec le MÊME event_id, mais pas sur un 4xx', async () => {
    const ids: string[] = [];
    let calls = 0;
    const flaky = (async (_u: string, init: RequestInit) => {
      ids.push(JSON.parse(String(init.body)).event_id);
      calls += 1;
      if (calls === 1) throw new Error('réseau');
      return new Response('{}', { status: calls === 2 ? 503 : 200 });
    }) as unknown as typeof fetch;
    const ok = await notifyEduloc(event, { url: 'u', secret: 's'.repeat(32), http: flaky, sleep: noSleep });
    assert.deepEqual({ ok: ok.ok, attempts: ok.attempts }, { ok: true, attempts: 3 });
    assert.equal(new Set(ids).size, 1);

    let n = 0;
    const refused = (async () => (n += 1, new Response('{}', { status: 403 }))) as unknown as typeof fetch;
    const denied = await notifyEduloc(event, { url: 'u', secret: 's'.repeat(32), http: refused, sleep: noSleep });
    assert.deepEqual({ ok: denied.ok, status: denied.status, attempts: denied.attempts, n }, { ok: false, status: 403, attempts: 1, n: 1 });
  });
});
