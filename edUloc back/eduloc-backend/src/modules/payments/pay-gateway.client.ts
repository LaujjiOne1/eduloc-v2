import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../core/config/app.config';

/** Ce que le service de paiement répond quand EduLoc lui demande l'état d'un paiement (de serveur à serveur, MM-03). */
export interface GatewayStatus {
  /** PENDING | SUCCEEDED | FAILED | CANCELLED | EXPIRED (ou un statut intermédiaire que `toInternalStatus` ramène à PENDING). */
  state: string;
  verifiedAmount: string | null;
  currency: string | null;
  verifiedAt: string | null;
  method: string | null;
  provider: string | null;
  providerRef: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
}

const TIMEOUT_MS = 5_000;

/**
 * Client du service de paiement externe. Tant que son API n'est pas branchée (PAY_API_URL vide), `available` est faux et
 * le statut ne vient que des notifications signées : rien ne casse, rien n'est inventé.
 *
 * Contrat attendu (voir docs/payments-integration.md) :
 *   GET {PAY_API_URL}/api/v1/payments/{paymentId}/status    Authorization: Bearer {PAY_API_KEY}
 */
@Injectable()
export class PayGatewayClient {
  private readonly logger = new Logger(PayGatewayClient.name);

  constructor(private readonly cfg: AppConfig) {}

  get available(): boolean {
    return this.cfg.payments.enabled && !!this.cfg.payments.apiUrl && this.cfg.payments.apiKey.length > 0;
  }

  /** Renvoie null si le service est injoignable ou répond mal : l'appelant garde alors le statut connu (jamais un échec). */
  async fetchStatus(paymentId: string): Promise<GatewayStatus | null> {
    if (!this.available) return null;
    try {
      const response = await fetch(`${this.cfg.payments.apiUrl}/api/v1/payments/${encodeURIComponent(paymentId)}/status`, {
        headers: { Authorization: `Bearer ${this.cfg.payments.apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Vérification de statut refusée (HTTP ${response.status}) pour le paiement ${paymentId}.`);
        return null;
      }
      const body = (await response.json()) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
      const amount = body.verified_amount;
      const state = str(body.state ?? body.status);
      if (!state) return null;
      return {
        state,
        verifiedAmount: typeof amount === 'number' ? amount.toFixed(2) : str(amount),
        currency: str(body.currency),
        verifiedAt: str(body.verified_at),
        method: str(body.method ?? body.payment_method_type),
        provider: str(body.provider ?? body.operator),
        providerRef: str(body.provider_ref ?? body.operator_reference),
        cardBrand: str(body.card_brand),
        cardLast4: str(body.card_last4),
      };
    } catch (error) {
      this.logger.warn(`Service de paiement injoignable : ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
