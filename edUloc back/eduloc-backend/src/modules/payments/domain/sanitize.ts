/**
 * Nettoyage des données avant journalisation (SEC-10) : ni CVV, ni numéro de carte complet, ni PIN, ni secret.
 * Défense en profondeur : EduLoc ne reçoit jamais ces données, mais un service tiers pourrait en laisser passer une par erreur.
 */
const FORBIDDEN_KEY = /(^|[_-])(cvv|cvc|pin|pan|otp)($|[_-])|card_?number|phone_?number|secret|token|authorization|password|signature/i;

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 4) return '[tronqué]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeForAudit(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = FORBIDDEN_KEY.test(key) ? '[retiré]' : sanitizeForAudit(v, depth + 1);
  }
  return out;
}
