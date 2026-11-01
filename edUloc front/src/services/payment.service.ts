import { ApiError } from "@/api/errors";
import { priceLabel } from "@/api/format/datetime";
import { rebaseLocalhost } from "@/api/config";
import { api, uuid } from "@/api/http";
import type { MoneyDto } from "@/api/contracts/dto";
import type { Payment, PaymentMethod, PaymentStatus, PaymentTicket } from "@/types/payment";
import { t } from "@/i18n";

export { ApiError as PaymentServiceError };

/** Forme renvoyée par le backend (modules/payments/payments.service.ts → toResponse). */
interface PaymentDto {
  id: string;
  bookingId: string;
  amount: MoneyDto;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
  method: "VISA" | "MOBILE_MONEY" | null;
  provider: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  settledAt: string | null;
  createdAt: string;
}

interface TicketDto {
  payment: PaymentDto;
  checkoutUrl: string;
  expiresAt: string;
}

const STATUS: Record<PaymentDto["status"], PaymentStatus> = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};
const METHOD: Record<NonNullable<PaymentDto["method"]>, PaymentMethod> = { VISA: "visa", MOBILE_MONEY: "mobile_money" };

function toPayment(dto: PaymentDto): Payment {
  return {
    id: dto.id,
    bookingId: dto.bookingId,
    amount: { value: Number(dto.amount.amount), currency: dto.amount.currency, label: priceLabel(dto.amount) },
    status: STATUS[dto.status] ?? "pending",
    method: dto.method ? METHOD[dto.method] : null,
    provider: dto.provider,
    cardBrand: dto.cardBrand,
    cardLast4: dto.cardLast4,
    createdAt: dto.createdAt,
    settledAt: dto.settledAt,
  };
}

/**
 * La page de paiement ne s'ouvre que sur une adresse sûre : HTTPS (HTTP seulement en développement, pour le service de
 * paiement local), sans identifiants dans l'URL. Le jeton signé est dans le fragment, jamais dans le chemin (SEC-01).
 */
export function assertSafeCheckoutUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(rebaseLocalhost(raw));
  } catch {
    throw ApiError.local("server_error", t("services.paymentservice.invalidCheckoutUrl"));
  }
  const secure = url.protocol === "https:" || (__DEV__ && url.protocol === "http:");
  if (!secure || url.username || url.password) throw ApiError.local("server_error", t("services.paymentservice.invalidCheckoutUrl"));
  return url.toString();
}

/**
 * Passerelle vers le service de paiement. Le backend émet un ticket signé (montant calculé côté serveur) ; l'application
 * ouvre la page de paiement dans une WebView puis ne fait confiance qu'au statut relu auprès du backend.
 * Tant que le service de paiement n'est pas branché, le backend répond 503 PAYMENTS_UNAVAILABLE (« bientôt disponible »).
 */
export const PaymentService = {
  /** Émet un ticket pour une réservation. Idempotent : la même clé rejoue la même réponse (SEC-07). */
  async createTicket(bookingId: string, idempotencyKey: string = uuid()): Promise<PaymentTicket> {
    const dto = await api.post<TicketDto>(`/bookings/${bookingId}/payments`, undefined, { headers: { "Idempotency-Key": idempotencyKey } });
    return { payment: toPayment(dto.payment), checkoutUrl: assertSafeCheckoutUrl(dto.checkoutUrl), expiresAt: dto.expiresAt };
  },

  /** Statut d'un paiement : la seule source de vérité après le retour de la page de paiement (SEC-06). */
  async getPayment(paymentId: string): Promise<Payment> {
    return toPayment(await api.get<PaymentDto>(`/payments/${paymentId}`));
  },

  async getBookingPayments(bookingId: string): Promise<Payment[]> {
    return (await api.get<PaymentDto[]>(`/bookings/${bookingId}/payments`)).map(toPayment);
  },
};
