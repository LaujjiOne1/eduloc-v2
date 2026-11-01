import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CheckCircleIcon, ClockIcon, XCircleIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import type { Payment } from "@/types/payment";

type PaymentResultProps = {
  paymentId: string;
  /** « Terminer » : retour à la réservation. */
  onDone: () => void;
  /** « Réessayer » : nouveau ticket pour la même réservation (absent si on ne peut pas en émettre ici). */
  onRetry?: () => void;
  retrying?: boolean;
  retryError?: string | null;
};

/** Ligne « moyen de paiement » : références techniques seulement (marque + 4 derniers chiffres, ou opérateur). */
function methodLine(payment: Payment, t: (key: never, options?: never) => string): string | null {
  const translate = t as unknown as (key: string, options?: Record<string, string>) => string;
  if (payment.method === "visa" && payment.cardLast4) {
    return translate("payment.viaCard", { brand: (payment.cardBrand ?? "Visa").toUpperCase(), last4: payment.cardLast4 });
  }
  if (payment.method === "mobile_money") return translate("payment.viaMobileMoney", { provider: payment.provider ?? "" }).replace(" ()", "");
  return null;
}

/**
 * Résultat d'un paiement, lu auprès du BACKEND. Trois issues honnêtes : confirmé, échoué/annulé/expiré, ou « toujours en
 * cours de vérification » (jamais présenté comme un échec : un opérateur peut mettre quelques minutes à répondre, MM-02).
 */
export function PaymentResult({ paymentId, onDone, onRetry, retrying, retryError }: PaymentResultProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { state, recheck } = usePaymentStatus(paymentId);

  let body: React.ReactNode;
  if (state.status === "checking") {
    body = (
      <>
        <ActivityIndicator size="large" color="#332E86" />
        <Text className="text-center text-[18px] font-bold font-display text-ink">{t("payment.verifying")}</Text>
        <Text className="max-w-[300px] text-center text-[13.5px] leading-[20px] text-ink-soft">{t("payment.verifyingHint")}</Text>
      </>
    );
  } else if (state.status === "final" && state.payment.status === "succeeded") {
    const line = methodLine(state.payment, t as never);
    body = (
      <>
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-accent-tint">
          <CheckCircleIcon size={46} color="#0E9C82" />
        </View>
        <Text className="text-center text-[22px] font-bold font-display text-ink">{t("payment.succeededTitle")}</Text>
        <Text className="max-w-[300px] text-center text-[14px] leading-[20px] text-ink-soft">
          {t("payment.succeededBody", { amount: state.payment.amount.label })}
        </Text>
        {line ? <Text className="text-[13px] font-semibold text-ink-soft">{line}</Text> : null}
      </>
    );
  } else if (state.status === "final") {
    const title =
      state.payment.status === "cancelled" ? t("payment.cancelledTitle") : state.payment.status === "expired" ? t("payment.expiredTitle") : t("payment.failedTitle");
    body = (
      <>
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-error-tint">
          <XCircleIcon size={46} color="#AC4A40" />
        </View>
        <Text className="text-center text-[22px] font-bold font-display text-ink">{title}</Text>
        <Text className="max-w-[300px] text-center text-[14px] leading-[20px] text-ink-soft">{t("payment.failedBody")}</Text>
      </>
    );
  } else {
    // still_pending ou error : on ne sait pas — jamais présenté comme un échec.
    body = (
      <>
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-warning-tint">
          <ClockIcon size={42} color="#D4890A" />
        </View>
        <Text className="text-center text-[22px] font-bold font-display text-ink">{t("payment.pendingTitle")}</Text>
        <Text className="max-w-[310px] text-center text-[14px] leading-[20px] text-ink-soft">
          {state.status === "error" ? state.message : t("payment.pendingBody")}
        </Text>
      </>
    );
  }

  const settled = state.status === "final";
  const failed = state.status === "final" && state.payment.status !== "succeeded";

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="flex-1 items-center justify-center gap-4 px-7">
        <FadeIn key={state.status}>
          <View className="items-center gap-4">{body}</View>
        </FadeIn>
        {retryError ? <FormError message={retryError} /> : null}
      </View>

      <View className="gap-3 px-5" style={{ paddingBottom: Math.max(insets.bottom, 22) }}>
        {failed && onRetry ? <Button label={t("payment.retry")} onPress={onRetry} loading={retrying} variant="animated" animatedGlow fullWidth /> : null}
        {state.status === "still_pending" || state.status === "error" ? <Button label={t("payment.checkAgain")} variant="secondary" onPress={recheck} fullWidth /> : null}
        {state.status !== "checking" ? (
          <Button label={settled && !failed ? t("payment.done") : t("payment.close")} variant={failed || !settled ? "ghost" : "primary"} onPress={onDone} fullWidth />
        ) : null}
      </View>
    </View>
  );
}
