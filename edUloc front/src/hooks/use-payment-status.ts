import { useCallback, useEffect, useRef, useState } from "react";

import { isApiError } from "@/api/errors";
import { PaymentService } from "@/services/payment.service";
import { type Payment, isFinalPaymentStatus } from "@/types/payment";
import { t } from "@/i18n";

export type PaymentStatusState =
  | { status: "checking"; payment: Payment | null }
  /** Résultat final connu du backend (réussi, échoué, annulé, expiré). */
  | { status: "final"; payment: Payment }
  /** Toujours « en cours » après l'attente : le résultat n'est pas connu, ce n'est PAS un échec (MM-02). */
  | { status: "still_pending"; payment: Payment | null }
  | { status: "error"; message: string };

/** Relectures rapprochées au début (le résultat arrive vite), puis espacées. Au total ~2 minutes. */
const DELAYS_MS = [1500, 1500, 2500, 2500, 2500, 4000, 4000, 4000, 6000, 6000, 6000, 8000, 8000, 8000, 10000, 10000];

/**
 * Suit un paiement auprès du BACKEND (jamais auprès de la page de paiement : son adresse de retour n'est pas une preuve,
 * SEC-06). S'arrête dès qu'un résultat final est connu ; sinon rend la main avec « toujours en cours ».
 */
export function usePaymentStatus(paymentId: string | undefined) {
  const [state, setState] = useState<PaymentStatusState>({ status: "checking", payment: null });
  const run = useRef(0);

  const check = useCallback(async () => {
    const mine = ++run.current;
    // Lien de retour sans identifiant de paiement : rien à vérifier.
    if (!paymentId) {
      setState({ status: "error", message: t("payment.noSession") });
      return;
    }
    setState((previous) => ({ status: "checking", payment: previous.status === "error" ? null : previous.payment }));
    let last: Payment | null = null;
    for (let attempt = 0; attempt <= DELAYS_MS.length; attempt += 1) {
      try {
        last = await PaymentService.getPayment(paymentId);
        if (mine !== run.current) return;
        if (isFinalPaymentStatus(last.status)) {
          setState({ status: "final", payment: last });
          return;
        }
        setState({ status: "checking", payment: last });
      } catch (error) {
        if (mine !== run.current) return;
        // Un échec réseau passager ne ferme pas la vérification : on réessaie jusqu'au bout.
        if (attempt === DELAYS_MS.length) {
          setState({ status: "error", message: isApiError(error) ? error.message : t("payment.pageErrorHint") });
          return;
        }
      }
      if (attempt < DELAYS_MS.length) await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]));
      if (mine !== run.current) return;
    }
    setState({ status: "still_pending", payment: last });
  }, [paymentId]);

  useEffect(() => {
    void Promise.resolve().then(check);
    return () => {
      run.current += 1; // annule la boucle en cours au démontage
    };
  }, [check]);

  return { state, recheck: check };
}
