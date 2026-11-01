import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CheckCircleIcon, ClockIcon, LockIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useBookingPayments } from "@/hooks/use-booking-payments";
import { usePayBooking } from "@/hooks/use-pay-booking";

type PaymentCardProps = {
  bookingId: string;
  /** Total de la réservation, déjà formaté (« 47 000 Ar ») : affichage seulement, le montant payé est recalculé par le serveur. */
  totalLabel: string | null;
};

/**
 * Carte « Paiement » du détail d'une réservation : à payer / en cours / payé. Le bouton ouvre la page du service de paiement
 * dans l'application. Tant que ce service n'est pas branché côté serveur, un message « bientôt disponible » remplace le bouton.
 */
export function PaymentCard({ bookingId, totalLabel }: PaymentCardProps) {
  const { t } = useTranslation();
  const { state, reload } = useBookingPayments(bookingId);
  const { state: pay, start } = usePayBooking(bookingId);

  // Retour de l'écran de paiement : le statut est relu.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (state.status === "loading") {
    return (
      <View className="mb-4 items-center rounded-2xl border border-line-soft bg-surface p-5 shadow-card">
        <ActivityIndicator color="#332E86" />
      </View>
    );
  }
  if (state.status === "error") return null; // le paiement est un plus : une erreur de lecture ne bloque pas la réservation

  const latest = state.latest;
  const paid = latest?.status === "succeeded";
  const inProgress = latest?.status === "pending";
  const lastFailed = latest !== null && !paid && !inProgress;
  const amountLabel = latest?.amount.label ?? totalLabel;

  return (
    <View className="mb-4 rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[15px] font-bold font-display text-ink">{t("payment.cardTitle")}</Text>
        {paid ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-accent-tint px-2.5 py-[4px]">
            <CheckCircleIcon size={13} color="#0E9C82" />
            <Text className="text-[12px] font-bold text-accent">{t("payment.paid")}</Text>
          </View>
        ) : inProgress ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-warning-tint px-2.5 py-[4px]">
            <ClockIcon size={12} color="#D4890A" />
            <Text className="text-[12px] font-bold text-warning">{t("payment.inProgress")}</Text>
          </View>
        ) : null}
      </View>

      {amountLabel ? <Text className="text-[20px] font-bold font-display text-primary">{amountLabel}</Text> : null}

      {paid ? null : (
        <>
          {lastFailed ? <Text className="mt-1 text-[12.5px] text-error">{t("payment.lastFailed")}</Text> : null}

          {pay.status === "unavailable" ? (
            <Text className="mt-3 text-[13px] leading-[19px] text-ink-soft">{t("payment.unavailable")}</Text>
          ) : (
            <View className="mt-3">
              <Button
                label={inProgress ? t("payment.resume") : amountLabel ? t("payment.payNow", { amount: amountLabel }) : t("payment.toPay")}
                variant="animated"
                animatedGlow
                loading={pay.status === "starting"}
                loadingLabel={t("payment.opening")}
                onPress={() => void start()}
                fullWidth
              />
            </View>
          )}
          {pay.status === "error" ? <Text className="mt-2 text-[12.5px] text-error">{pay.message}</Text> : null}

          <View className="mt-3 flex-row items-start gap-1.5">
            <LockIcon size={12} color="#9799AF" />
            <Text className="flex-1 text-[11.5px] leading-[16px] text-ink-faint">{t("payment.securityNote")}</Text>
          </View>
        </>
      )}
    </View>
  );
}
