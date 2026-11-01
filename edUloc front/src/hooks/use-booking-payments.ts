import { useCallback, useState } from "react";

import { isApiError } from "@/api/errors";
import { useLoadEffect } from "@/hooks/use-load-effect";
import { useRealtimeReload } from "@/realtime/use-realtime-event";
import { PaymentService } from "@/services/payment.service";
import type { Payment } from "@/types/payment";
import { t } from "@/i18n";

export type BookingPaymentsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** `latest` : le paiement le plus récent (null = jamais tenté). */
  | { status: "success"; payments: Payment[]; latest: Payment | null };

/** Paiements d'une réservation. Se met à jour en direct quand le backend reçoit le résultat du service de paiement. */
export function useBookingPayments(bookingId: string | undefined) {
  const [state, setState] = useState<BookingPaymentsState>({ status: "loading" });

  const load = useCallback(
    async (silent = false) => {
      if (!bookingId) return;
      if (!silent) setState({ status: "loading" });
      try {
        const payments = await PaymentService.getBookingPayments(bookingId);
        setState({ status: "success", payments, latest: payments[0] ?? null });
      } catch (error) {
        if (silent) return;
        setState({ status: "error", message: isApiError(error) ? error.message : t("payment.cannotStart") });
      }
    },
    [bookingId],
  );

  useLoadEffect(load);
  useRealtimeReload(() => void load(true), ["payment."]);

  return { state, reload: useCallback(() => load(true), [load]) };
}
