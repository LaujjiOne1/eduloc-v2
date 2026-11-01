import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ClockIcon, LocationIcon, StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import type { Tutor } from "@/types/tutor";

export const TUTOR_AVATAR_TONE_CLASSES: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-primary-tint", text: "text-primary" },
  violet: { bg: "bg-violet-tint", text: "text-violet" },
  accent: { bg: "bg-accent-tint", text: "text-accent" },
  navy: { bg: "bg-primary-tint", text: "text-primary" },
  amber: { bg: "bg-amber-100", text: "text-amber-800" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-800" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-800" },
  rose: { bg: "bg-rose-100", text: "text-rose-800" },
};

export const DEFAULT_AVATAR_TONE = { bg: "bg-primary-tint", text: "text-primary" };

export function getTutorAvatarTone(tone?: string | null): { bg: string; text: string } {
  if (!tone) return DEFAULT_AVATAR_TONE;
  return TUTOR_AVATAR_TONE_CLASSES[tone] ?? DEFAULT_AVATAR_TONE;
}

function locationLine(tutor: Tutor): string {
  return tutor.location.distanceKm != null
    ? `${tutor.location.label}, ${tutor.location.distanceKm} km`
    : tutor.location.label;
}

type TutorCardProps = {
  tutor: Tutor;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Ligne de résultat : photo, nom, matière, prix bien en vue, puis quelques étiquettes (niveau, format, prochaine
 * disponibilité). Un tuteur sans avis est « Nouveau tuteur » plutôt qu'une note de 0,0 qui sonne comme un échec.
 */
export function TutorCard({ tutor, onPress, disabled }: TutorCardProps) {
  const { t } = useTranslation();
  const offer = tutor.offers[0];
  const online = tutor.formats.includes("online");
  const inPerson = tutor.formats.includes("in_person");
  // Format proposé, en une étiquette : « En ligne », « Présentiel » ou « En ligne & présentiel ».
  const formatLabel =
    online && inPerson ? t("results.results.onlineAndInPerson") : online ? t("common.online") : inPerson ? t("common.inPerson") : null;
  const tags = [tutor.levels[0], formatLabel].filter((tag): tag is string => Boolean(tag));
  const hasReviews = tutor.reviewCount > 0;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${tutor.firstName} ${tutor.lastName}`}
    >
      <View className="mb-3 rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
        <View className="flex-row gap-[14px]">
          <TutorAvatar
            gender={tutor.gender}
            photoUrl={tutor.photoUrl}
            name={`${tutor.firstName} ${tutor.lastName}`}
            size={64}
            radius={16}
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="shrink text-[16px] font-bold font-display text-ink" numberOfLines={1}>
                    {tutor.firstName} {tutor.lastName}
                  </Text>
                  {tutor.isVerified ? <VerifiedBadgeIcon size={15} /> : null}
                </View>
                <Text className="mt-[2px] text-[13px] text-ink-soft" numberOfLines={1}>
                  {tutor.subjects[0] ?? ""}
                </Text>
              </View>
              {offer ? (
                <View className="items-end">
                  <Text className="text-[16px] font-bold font-display text-primary">{offer.priceLabel}</Text>
                  <Text className="text-[11.5px] text-ink-faint">{offer.durationLabel}</Text>
                </View>
              ) : null}
            </View>

            <View className="mt-2 flex-row items-center gap-2">
              {hasReviews ? (
                <View className="flex-row items-center gap-1 rounded-full bg-warning-tint px-2 py-[3px]">
                  <StarIcon size={12} color="#D4890A" filled />
                  <Text className="text-[12px] font-bold text-ink">{tutor.rating.toFixed(1)}</Text>
                  <Text className="text-[12px] text-ink-soft">({tutor.reviewCount})</Text>
                </View>
              ) : (
                <View className="rounded-full bg-accent-tint px-2.5 py-[3px]">
                  <Text className="text-[12px] font-semibold text-accent">{t("results.results.newTutor")}</Text>
                </View>
              )}
              <View className="min-w-0 flex-1 flex-row items-center gap-1">
                <LocationIcon size={12} />
                <Text className="shrink text-[12px] text-ink-faint" numberOfLines={1}>
                  {locationLine(tutor)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {tutor.matchReasons && tutor.matchReasons.length > 0 ? (
          <Text className="mt-3 text-[12.5px] font-semibold text-primary" numberOfLines={2}>
            {tutor.matchReasons.join(" • ")}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {tags.map((tag) => (
            <View key={tag} className="rounded-full bg-paper-alt px-2.5 py-[5px]">
              <Text className="text-[12px] font-semibold text-ink-soft">{tag}</Text>
            </View>
          ))}
          {tutor.nextSlotLabel ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent-tint px-2.5 py-[5px]">
              <ClockIcon size={12} color="#0E9C82" />
              <Text className="text-[12px] font-semibold text-accent" numberOfLines={1}>
                {tutor.nextSlotLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
