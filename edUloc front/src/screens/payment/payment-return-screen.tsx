import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { PaymentResult } from "@/components/payment/payment-result";
import { usePaymentSessionStore } from "@/store/payment-session.store";

/**
 * Retour par lien profond (`eduloc://payment/return?payment=<id>`), par exemple depuis l'application d'un opérateur Mobile
 * Money. Ce lien ne prouve rien : l'écran relit le statut auprès du backend (SEC-06).
 */
export function PaymentReturnScreen() {
  const router = useRouter();
  const { payment } = useLocalSearchParams<{ payment?: string }>();
  const clear = usePaymentSessionStore((s) => s.clear);

  const close = () => {
    clear();
    if (router.canGoBack()) router.back();
    else router.replace("/apprenti-dashboard" as Href);
  };

  return <PaymentResult paymentId={payment ?? ""} onDone={close} />;
}
