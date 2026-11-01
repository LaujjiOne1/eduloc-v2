import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Ticket de paiement : jeton JWT HS256 signé par le backend EduLoc, que le service de paiement (eduloc-pay-subscriptions)
 * vérifie avant d'ouvrir la page de paiement. Il porte tout ce dont la page a besoin — la réservation, le MONTANT
 * (calculé côté serveur, SEC-03), le client, l'adresse de retour et celle de notification — sans que l'application mobile
 * puisse en modifier un octet. Il est court (quelques minutes) et ne contient aucun secret ni donnée de carte.
 */
export const TICKET_ISSUER = 'eduloc-api';
export const TICKET_AUDIENCE = 'eduloc-pay';

export interface TicketClaims {
  /** Identifiant du paiement côté EduLoc : clé de toute la conversation entre les deux services. */
  sub: string;
  reservation_id: string;
  /** Décimal en chaîne (« 47000.00 ») : pas de flottant pour de l'argent. */
  amount: string;
  currency: string;
  customer_name: string;
  customer_email: string;
  /** Libellé affiché sur la page de paiement (« Mathématiques — Lova R. »). */
  description: string;
  /** Où ramener l'utilisateur à la fin (schéma de l'application). Ce n'est PAS une preuve de paiement (SEC-06). */
  return_url: string;
  /** Où le service de paiement notifie le résultat (webhook signé, SEC-05). */
  callback_url: string;
}

export interface SignedTicket extends TicketClaims {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  /** Identifiant unique du ticket (un nouveau ticket par ouverture, même paiement). */
  jti: string;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');
const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest();

/** Signe un ticket. `now` en secondes Unix (injectable pour les tests). */
export function signTicket(
  claims: TicketClaims,
  opts: { secret: string; ttlSeconds: number; jti: string; now?: number },
): { token: string; payload: SignedTicket } {
  const iat = opts.now ?? Math.floor(Date.now() / 1000);
  const payload: SignedTicket = {
    ...claims, iss: TICKET_ISSUER, aud: TICKET_AUDIENCE, iat, exp: iat + opts.ttlSeconds, jti: opts.jti,
  };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return { token: `${head}.${body}.${b64url(sign(`${head}.${body}`, opts.secret))}`, payload };
}

/**
 * Vérifie un ticket (utilisé par les tests et par l'outil de simulation ; le service de paiement fait la même chose de son
 * côté). Renvoie null si la signature, l'algorithme, l'émetteur, l'audience ou l'expiration ne conviennent pas.
 */
export function verifyTicket(token: string, secret: string, now = Math.floor(Date.now() / 1000)): SignedTicket | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;
  try {
    const header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null; // jamais « none », jamais un autre algorithme
    const expected = sign(`${head}.${body}`, secret);
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedTicket;
    if (payload.iss !== TICKET_ISSUER || payload.aud !== TICKET_AUDIENCE) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
