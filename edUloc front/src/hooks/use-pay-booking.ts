import { type Href, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { isApiError } from "@/api/errors";
import { uuid } from "@/api/http";
import { PaymentService } from "@/services/payment.service";
import { usePaymentSessionStore } from "@/store/payment-session.store";
import type { PaymentTicket } from "@/types/payment";
import { t } from "@/i18n";

export type PayBookingState =
  | { status: "idle" }
  | { status: "starting" }
  /** Le service de paiement n'est pas encore branché côté serveur : un message « bientôt disponible », pas une erreur. */
  | { status: "unavailable" }
  | { status: "error"; message: string };

const PAYMENT_ROUTE = "/payment" as Href;

/**
 * Lance le paiement d'une réservation : le backend émet un ticket signé (montant calculé côté serveur), puis l'écran de
 * paiement ouvre la page du service de paiement. Une même clé d'idempotence couvre les doubles touchers (SEC-07).
 */
export function usePayBooking(bookingId: string) {
  const router = useRouter();
  const [state, setState] = useState<PayBookingState>({ status: "idle" });
  const openSession = usePaymentSessionStore((s) => s.open);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(uuid());

  /** Ouvre l'écran de paiement sur un ticket déjà émis (retour sur un paiement en cours, nouvel essai). */
  const openTicket = useCallback(
    (ticket: PaymentTicket) => {
      openSession({ paymentId: ticket.payment.id, bookingId, checkoutUrl: ticket.checkoutUrl, amountLabel: ticket.payment.amount.label });
      router.push(PAYMENT_ROUTE);
    },
    [bookingId, openSession, router],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setState({ status: "starting" });
    try {
      const ticket = await PaymentService.createTicket(bookingId, idempotencyKey.current);
      openTicket(ticket);
      setState({ status: "idle" });
      // Une clé neuve pour la prochaine demande : celle-ci a abouti, la rejouer renverrait un ticket déjà utilisé.
      idempotencyKey.current = uuid();
      return true;
    } catch (error) {
      if (isApiError(error) && error.code === "payments_unavailable") setState({ status: "unavailable" });
      else setState({ status: "error", message: isApiError(error) ? error.message : t("payment.cannotStart") });
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [bookingId, openTicket]);

  return { state, start };
}
