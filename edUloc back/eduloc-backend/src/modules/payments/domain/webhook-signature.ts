import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature des notifications envoyées par le service de paiement (SEC-05) :
 *
 *   X-Eduloc-Pay-Signature: t=<secondes Unix>,v1=<hex(HMAC-SHA256(secret, "<t>.<corps brut>"))>
 *
 * L'horodatage est signé avec le corps : une notification interceptée ne peut pas être rejouée après la tolérance.
 */
export const SIGNATURE_HEADER = 'x-eduloc-pay-signature';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function computeSignature(secret: string, timestamp: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function buildSignatureHeader(secret: string, rawBody: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${computeSignature(secret, timestamp, rawBody)}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'mismatch' };

export function verifySignature(
  header: string | undefined,
  rawBody: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing' };
  const fields = new Map(header.split(',').map((part) => {
    const [k, ...v] = part.trim().split('=');
    return [k, v.join('=')] as const;
  }));
  const t = Number(fields.get('t'));
  const v1 = fields.get('v1');
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return { ok: false, reason: 'malformed' };
  if (Math.abs(now - t) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  const expected = Buffer.from(computeSignature(secret, t, rawBody), 'hex');
  const given = Buffer.from(v1, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected) ? { ok: true } : { ok: false, reason: 'mismatch' };
}
