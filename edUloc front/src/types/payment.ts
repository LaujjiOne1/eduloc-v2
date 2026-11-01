/**
 * Paiement d'une réservation, orchestré par le backend avec le service de paiement externe (eduloc-pay-subscriptions).
 * Routes backend : POST /bookings/:id/payments, GET /bookings/:id/payments, GET /payments/:id.
 *
 * L'application n'est jamais une source de vérité : le statut vient TOUJOURS du backend, jamais de la page de paiement
 * ni de son adresse de retour (SEC-06). Aucune donnée de carte ni de PIN ne transite ici (VISA-02, MM-01).
 */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled" | "expired";
export type PaymentMethod = "visa" | "mobile_money";

export interface Payment {
  id: string;
  bookingId: string;
  /** Montant FIGÉ par le serveur (jamais saisi ni modifiable ici). */
  amount: { value: number; currency: string; label: string };
  status: PaymentStatus;
  method: PaymentMethod | null;
  /** « stripe », « orange-money »… tel que renvoyé par le service de paiement. */
  provider: string | null;
  /** Marque et quatre derniers chiffres seulement. */
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: string;
  settledAt: string | null;
}

/** Ticket émis par le backend : l'adresse de la page de paiement (le jeton signé est dans son fragment). */
export interface PaymentTicket {
  payment: Payment;
  checkoutUrl: string;
  expiresAt: string;
}

/** Résultat final : plus rien à attendre. `pending` = encore inconnu, jamais un échec (MM-02). */
export const isFinalPaymentStatus = (status: PaymentStatus) => status !== "pending";
