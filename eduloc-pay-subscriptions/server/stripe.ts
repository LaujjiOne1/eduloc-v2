/**
 * Client Stripe minimal (API REST, sans SDK). La carte n'est JAMAIS saisie chez nous : le navigateur la confie directement à
 * Stripe.js (champs hébergés par Stripe, conforme PCI DSS, Visa Secure / 3-D Secure dans son parcours : VISA-01, VISA-03).
 * Ici on ne manipule que le PaymentIntent : son montant (venu du ticket), sa référence et son résultat.
 */
export interface StripeIntent {
  id: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  amount: number;
  amount_received: number;
  currency: string;
  client_secret?: string;
  metadata?: Record<string, string>;
  last_payment_error?: { message?: string; code?: string } | null;
  latest_charge?: { payment_method_details?: { card?: { brand?: string; last4?: string } } } | string | null;
}

/** Devises sans centimes chez Stripe : le montant s'envoie tel quel (l'ariary est dans la liste). */
const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

/** « 47000.00 » + MGA → 47000 ; « 9.90 » + EUR → 990. */
export function toStripeAmount(amount: string, currency: string): number {
  const value = Number(amount);
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(value) : Math.round(value * 100);
}

/** Inverse de `toStripeAmount`, en chaîne décimale à deux chiffres comme le reste de l'échange. */
export function fromStripeAmount(amount: number, currency: string): string {
  return (ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100).toFixed(2);
}

type FetchLike = typeof fetch;
const API = 'https://api.stripe.com/v1';

export class StripeError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
    this.name = 'StripeError';
  }
}

export class StripeClient {
  constructor(
    private readonly secretKey: string,
    private readonly http: FetchLike = fetch,
  ) {}

  private async call<T>(method: 'GET' | 'POST', path: string, form?: URLSearchParams, headers: Record<string, string> = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.http(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          ...headers,
        },
        body: form,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new StripeError(`Stripe injoignable : ${error instanceof Error ? error.message : String(error)}`);
    }
    const body = (await response.json().catch(() => null)) as any;
    if (!response.ok) throw new StripeError(body?.error?.message ?? `Stripe a répondu HTTP ${response.status}`, response.status);
    return body as T;
  }

  /**
   * PaymentIntent d'un paiement EduLoc. La clé d'idempotence dérive de l'identifiant du paiement : rouvrir la page ou rejouer la
   * requête renvoie LE MÊME PaymentIntent, jamais un second (SEC-07). Le service reste sans base : tout se retrouve par cette clé
   * et par les métadonnées.
   */
  createIntent(args: { paymentId: string; reservationId: string; amount: number; currency: string; description: string }): Promise<StripeIntent> {
    const form = new URLSearchParams();
    form.set('amount', String(args.amount));
    form.set('currency', args.currency.toLowerCase());
    form.append('payment_method_types[]', 'card');
    form.set('description', args.description.slice(0, 250));
    form.set('metadata[payment_id]', args.paymentId);
    form.set('metadata[reservation_id]', args.reservationId);
    return this.call<StripeIntent>('POST', '/payment_intents', form, { 'Idempotency-Key': `eduloc-pi-${args.paymentId}` });
  }

  /** Relit le PaymentIntent auprès de Stripe (jamais confiance à un corps de webhook : MM-03 / VISA-04). */
  retrieveIntent(id: string): Promise<StripeIntent> {
    return this.call<StripeIntent>('GET', `/payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`);
  }

  cancelIntent(id: string): Promise<StripeIntent> {
    return this.call<StripeIntent>('POST', `/payment_intents/${encodeURIComponent(id)}/cancel`, new URLSearchParams());
  }
}

/** Marque et 4 derniers chiffres de la carte utilisée, quand Stripe les renvoie (rien d'autre n'est conservé). */
export function cardOf(intent: StripeIntent): { brand?: string; last4?: string } {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') return {};
  const card = charge.payment_method_details?.card;
  return { brand: card?.brand, last4: card?.last4 };
}
