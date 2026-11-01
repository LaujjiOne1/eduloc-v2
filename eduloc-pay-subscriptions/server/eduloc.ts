import { signatureHeader } from './security';

/** Notification envoyée au backend EduLoc (contrat : edUloc back/eduloc-backend/docs/payments-integration.md §3). */
export interface EdulocEvent {
  event_id: string;
  type: 'payment.updated';
  data: {
    payment_id: string;
    reservation_id: string;
    status: string;
    amount?: string;
    currency?: string;
    method?: string;
    provider?: string;
    provider_ref?: string;
    card_brand?: string;
    card_last4?: string;
    failure_reason?: string;
  };
}

export interface NotifyResult {
  ok: boolean;
  /** Dernier code HTTP reçu (0 = injoignable). */
  status: number;
  attempts: number;
}

type FetchLike = typeof fetch;
const RETRY_DELAYS_MS = [0, 1_000, 3_000, 8_000];

/**
 * Poste la notification SIGNÉE à EduLoc. Mêmes `event_id` à chaque essai : un renvoi n'est jamais appliqué deux fois côté EduLoc.
 * Réessaie sur erreur réseau et 5xx ; les 4xx (signature, paiement inconnu, incohérence) ne se rejouent pas : ce sont des
 * anomalies à examiner, pas des pannes.
 */
export async function notifyEduloc(
  event: EdulocEvent,
  opts: { url: string; secret: string; http?: FetchLike; sleep?: (ms: number) => Promise<void>; now?: () => number },
): Promise<NotifyResult> {
  const http = opts.http ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const body = JSON.stringify(event);
  let status = 0;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt]);
    try {
      const response = await http(opts.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Horodatage recalculé à chaque essai : un essai tardif ne dépasse pas la tolérance de ±5 min côté EduLoc.
          'X-Eduloc-Pay-Signature': signatureHeader(opts.secret, body, Math.floor((opts.now?.() ?? Date.now()) / 1000)),
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });
      status = response.status;
      if (response.ok) return { ok: true, status, attempts: attempt + 1 };
      if (status < 500) return { ok: false, status, attempts: attempt + 1 };
    } catch {
      status = 0;
    }
  }
  return { ok: false, status, attempts: RETRY_DELAYS_MS.length };
}
