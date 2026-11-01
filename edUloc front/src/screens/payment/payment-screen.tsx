import { type Href, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { isApiError } from "@/api/errors";
import { PaymentBrowser } from "@/components/payment/payment-browser";
import { PaymentResult } from "@/components/payment/payment-result";
import { Button } from "@/components/ui/button";
import { PaymentService } from "@/services/payment.service";
import { usePaymentSessionStore } from "@/store/payment-session.store";

const bookingRoute = (id: string) => `/apprenti-dashboard/bookings/${id}` as Href;

type Phase = "checkout" | "result";

/**
 * Paiement d'une réservation, comme une page web dans l'application : le service de paiement (autre serveur, autre base)
 * affiche sa page dans une WebView ; à la fin — ou à la fermeture — le statut est relu auprès du BACKEND EduLoc, qui l'a
 * reçu de ce service par notification signée ou l'a vérifié de serveur à serveur (SEC-05, SEC-06, MM-03).
 */
export function PaymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = usePaymentSessionStore((s) => s.session);
  const openSession = usePaymentSessionStore((s) => s.open);
  const clear = usePaymentSessionStore((s) => s.clear);
  const [phase, setPhase] = useState<Phase>("checkout");
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  // Change à chaque nouveau ticket : la WebView repart de zéro sur la nouvelle adresse.
  const [attempt, setAttempt] = useState(0);

  const finish = useCallback(() => {
    const bookingId = session?.bookingId;
    clear();
    if (router.canGoBack()) router.back();
    else if (bookingId) router.replace(bookingRoute(bookingId));
  }, [clear, router, session?.bookingId]);

  const retry = useCallback(async () => {
    if (!session || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const ticket = await PaymentService.createTicket(session.bookingId);
      openSession({ ...session, paymentId: ticket.payment.id, checkoutUrl: ticket.checkoutUrl, amountLabel: ticket.payment.amount.label });
      setAttempt((n) => n + 1);
      setPhase("checkout");
    } catch (error) {
      setRetryError(isApiError(error) ? error.message : t("payment.cannotStart"));
    } finally {
      setRetrying(false);
    }
  }, [openSession, retrying, session, t]);

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-center text-[14px] text-ink-soft">{t("payment.noSession")}</Text>
        <Button label={t("payment.close")} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as Href))} />
      </View>
    );
  }

  return phase === "checkout" ? (
    <PaymentBrowser key={`${session.paymentId}-${attempt}`} url={session.checkoutUrl} onDone={() => setPhase("result")} onClose={() => setPhase("result")} />
  ) : (
    <PaymentResult paymentId={session.paymentId} onDone={finish} onRetry={() => void retry()} retrying={retrying} retryError={retryError} />
  );
}
