import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Ticket émis par le backend EduLoc : JWT HS256 (voir edUloc back/eduloc-backend/docs/payments-integration.md).
 * Il porte le montant, la réservation et le client ; la page de paiement n'a AUCUN champ de montant (SEC-03).
 */
export const TICKET_ISSUER = 'eduloc-api';
export const TICKET_AUDIENCE = 'eduloc-pay';

export interface Ticket {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  /** Identifiant du paiement côté EduLoc (UUID). */
  sub: string;
  reservation_id: string;
  amount: string;
  currency: string;
  customer_name: string;
  customer_email: string;
  description: string;
  return_url: string;
  callback_url: string;
}

const b64urlDecode = (s: string) => Buffer.from(s, 'base64url');

/** Renvoie le ticket vérifié, ou null (signature, algorithme, émetteur, audience, expiration ou forme invalides). */
export function verifyTicket(token: unknown, secret: string, now = Math.floor(Date.now() / 1000)): Ticket | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;
  try {
    const header = JSON.parse(b64urlDecode(head).toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null; // jamais « none », jamais un autre algorithme
    const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
    const given = b64urlDecode(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const ticket = JSON.parse(b64urlDecode(body).toString('utf8')) as Ticket;
    if (ticket.iss !== TICKET_ISSUER || ticket.aud !== TICKET_AUDIENCE) return null;
    if (typeof ticket.exp !== 'number' || ticket.exp <= now) return null;
    if (!/^[0-9a-f-]{36}$/i.test(ticket.sub ?? '')) return null;
    const amount = Number(ticket.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(ticket.currency ?? '')) return null;
    return ticket;
  } catch {
    return null;
  }
}

/** En-tête de signature des notifications envoyées à EduLoc : `t=<s>,v1=<hex(HMAC-SHA256(secret, "<t>.<corps brut>"))>`. */
export function signatureHeader(secret: string, rawBody: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

/**
 * Signature Stripe (`Stripe-Signature: t=…,v1=…[,v1=…]`) : HMAC-SHA256 de « <t>.<corps brut> » avec le secret du endpoint,
 * tolérance d'horloge de 5 minutes.
 */
export function verifyStripeSignature(header: string | undefined, rawBody: Buffer, secret: string, now = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const entries = header.split(',').map((p) => p.trim().split('=') as [string, string]);
  const t = Number(entries.find(([k]) => k === 't')?.[1]);
  const candidates = entries.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isInteger(t) || Math.abs(now - t) > 300 || candidates.length === 0) return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  return candidates.some((hex) => {
    if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
    const given = Buffer.from(hex, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Comparaison en temps constant d'un secret présenté (clé d'API de statut). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}
