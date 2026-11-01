/**
 * Client du CRM Odoo, SEUL lieu de stockage des paiements (module eduloc_payments, endpoint /eduloc/api/v1/payments).
 * Ne reçoit jamais de donnée de carte ni de PIN : références techniques seulement (VISA-02, MM-01, section 4 du cahier).
 */
export type PaymentState = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface OdooPayment {
  payment_id: string;
  reservation_id: string;
  state: PaymentState;
  amount: string;
  currency: string;
  method: string | null;
  provider: string | null;
  provider_ref: string | null;
  operator_ref: string | null;
  card_brand: string | null;
  card_last4: string | null;
  verified_at: string | null;
  has_anomaly: boolean;
}

export interface OdooUpsert {
  event_id: string;
  payment_id: string;
  reservation_id?: string;
  status: PaymentState | string;
  amount?: string;
  currency?: string;
  method?: string;
  provider?: string;
  provider_ref?: string;
  operator_ref?: string;
  card_brand?: string;
  card_last4?: string;
  customer_name?: string;
  customer_email?: string;
  description?: string;
  failure_reason?: string;
  source?: string;
}

export type UpsertResult =
  | { status: 'created' | 'updated' | 'unchanged' | 'duplicate'; payment: OdooPayment | null }
  /** Incohérence avec ce qu'Odoo a enregistré : rien n'a été validé, une anomalie est signalée dans le CRM. */
  | { status: 'rejected'; reason: string; payment: OdooPayment | null };

export class OdooError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
    this.name = 'OdooError';
  }
}

type FetchLike = typeof fetch;
const TIMEOUT_MS = 8_000;

export class OdooPayments {
  constructor(
    private readonly cfg: { url: string; token: string },
    private readonly http: FetchLike = fetch,
  ) {}

  private async call(path: string, init: RequestInit): Promise<{ status: number; body: any }> {
    let response: Response;
    try {
      response = await this.http(`${this.cfg.url}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new OdooError(`CRM Odoo injoignable : ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  /** Crée ou fait évoluer un paiement (idempotent par `event_id`). */
  async upsert(payload: OdooUpsert): Promise<UpsertResult> {
    const { status, body } = await this.call('/eduloc/api/v1/payments', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 422 && body?.error?.code === 'mismatch') {
      return { status: 'rejected', reason: String(body.reason ?? body.error?.message ?? 'incohérence'), payment: body.payment ?? null };
    }
    if (status === 200 || status === 201) return { status: body.status, payment: body.payment ?? null };
    throw new OdooError(`Odoo a refusé l'enregistrement (HTTP ${status}) : ${body?.error?.message ?? 'réponse inattendue'}`, status);
  }

  /** Lit un paiement ; null s'il n'existe pas. */
  async get(paymentId: string): Promise<OdooPayment | null> {
    const { status, body } = await this.call(`/eduloc/api/v1/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
    if (status === 404) return null;
    if (status === 200) return body.payment as OdooPayment;
    throw new OdooError(`Odoo a refusé la lecture (HTTP ${status}).`, status);
  }
}
