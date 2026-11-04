import { Text, View } from "react-native";

import { durationShortLabel, priceLabel } from "@/api/format/datetime";
import type { Offer } from "@/types/offer";
import { useTranslation } from "react-i18next";

type OfferPricingSummaryProps = {
  offer: Offer;
  /** Liste : tarif horaire, plage de durées et montants extrêmes. Sinon : un montant par durée réservable. */
  compact?: boolean;
};

/** Montant d'une séance : le prix de l'offre vaut pour sa durée par défaut, les autres durées sont proportionnelles. */
const amountFor = (offer: Offer, minutes: number) =>
  priceLabel({ amount: String((offer.price.amount * minutes) / offer.durationMinutes), currency: offer.price.currency });

/**
 * Ce que le tuteur propose en heures et en argent : tarif horaire, durées que les demandeurs peuvent réserver (déduites
 * de ses plages de disponibilité : de 1 h à la plus longue plage, par pas de 30 min) et montant de chacune.
 */
export function OfferPricingSummary({ offer, compact = false }: OfferPricingSummaryProps) {
  const { t } = useTranslation();
  const reservable = offer.bookableDurations.length > 0;
  // Sans plage d'au moins 1 h, seules les durées saisies sur l'offre subsistent (voir le message d'invitation).
  const durations = reservable
    ? offer.bookableDurations
    : [...new Set([offer.durationMinutes, ...offer.durationOptions])].sort((a, b) => a - b);
  const shortest = durations[0];
  const longest = durations[durations.length - 1];
  const hourly = priceLabel({ amount: String((offer.price.amount * 60) / offer.durationMinutes), currency: offer.price.currency });

  return (
    <View className="rounded-lg border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[12.5px] font-semibold text-ink-soft">{t("tutorDashboard.offers.hourlyRate")}</Text>
        <Text className="text-[15px] font-bold text-ink">{t("tutorDashboard.offers.perHour", { price: hourly })}</Text>
      </View>

      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-[12.5px] font-semibold text-ink-soft">{t("tutorDashboard.offers.bookableDurations")}</Text>
        <Text className="text-[14px] font-bold text-ink">
          {shortest === longest
            ? durationShortLabel(shortest)
            : t("tutorDashboard.offers.durationRange", { min: durationShortLabel(shortest), max: durationShortLabel(longest) })}
        </Text>
      </View>

      {compact ? (
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-[12.5px] font-semibold text-ink-soft">{t("tutorDashboard.offers.amount")}</Text>
          <Text className="text-[14px] font-bold text-primary">
            {shortest === longest
              ? amountFor(offer, shortest)
              : t("tutorDashboard.offers.amountRange", { min: amountFor(offer, shortest), max: amountFor(offer, longest) })}
          </Text>
        </View>
      ) : (
        <View className="mt-3 gap-[6px] border-t border-line-soft pt-3">
          <Text className="text-[12.5px] font-semibold text-ink-soft">{t("tutorDashboard.offers.amountByDuration")}</Text>
          {durations.map((minutes) => (
            <View key={minutes} className="flex-row items-center justify-between">
              <Text className="text-[13.5px] text-ink">{durationShortLabel(minutes)}</Text>
              <Text className="text-[13.5px] font-bold text-ink">{amountFor(offer, minutes)}</Text>
            </View>
          ))}
        </View>
      )}

      {!reservable ? (
        <Text className="mt-3 text-[12px] leading-[17px] text-error">{t("tutorDashboard.offers.addAvailabilityHint")}</Text>
      ) : null}
    </View>
  );
}
