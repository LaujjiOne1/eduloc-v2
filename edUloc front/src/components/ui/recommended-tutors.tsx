import { type Href, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { LocationIcon, StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import type { useRecommendedTutors } from "@/hooks/use-recommended-tutors";
import type { Tutor } from "@/types/tutor";

function tutorRoute(id: string): Href {
  return `/results/tutor/${id}` as Href;
}

/**
 * Bloc horizontal « Tuteurs recommandés » de l'accueil apprenant : des visages, des notes et des tarifs plutôt qu'un vide
 * sous les activités. Masqué tant qu'il n'y a rien à proposer.
 */
export function RecommendedTutors({ title: fixedTitle, source }: { title?: string; source: ReturnType<typeof useRecommendedTutors> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, nearby, placeLabel, requestPosition, positionLoading } = source;

  if (state.status === "empty") return null;

  const title = fixedTitle
    ? fixedTitle
    : nearby
    ? placeLabel
      ? t("apprentiDashboard.dashboard.recommendedNear", { place: placeLabel })
      : t("apprentiDashboard.dashboard.recommendedNearYou")
    : t("apprentiDashboard.dashboard.recommendedOnline");

  return (
    <View className="mb-7">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[17px] font-bold font-display text-ink" numberOfLines={2}>
          {title}
        </Text>
        {nearby ? null : (
          <PressableScale onPress={() => void requestPosition()} disabled={positionLoading} accessibilityLabel={t("apprentiDashboard.dashboard.aroundMe")}>
            <View className="flex-row items-center gap-[5px] rounded-full bg-primary-tint px-3 py-[7px]">
              <LocationIcon size={13} color="#332E86" />
              <Text className="text-[12.5px] font-bold text-primary">{t("apprentiDashboard.dashboard.aroundMe")}</Text>
            </View>
          </PressableScale>
        )}
      </View>

      {state.status === "loading" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }} scrollEnabled={false}>
          {[0, 1, 2].map((i) => (
            <View key={i} className="h-[208px] w-[168px] rounded-2xl bg-line-soft" />
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20, paddingBottom: 6 }}>
          {state.tutors.map((tutor) => (
            <RecommendedTutorCard key={tutor.id} tutor={tutor} onPress={() => router.push(tutorRoute(tutor.id))} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function RecommendedTutorCard({ tutor, onPress }: { tutor: Tutor; onPress: () => void }) {
  const { t } = useTranslation();
  const offer = tutor.offers[0];
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${tutor.firstName} ${tutor.lastName}`}>
      <View className="w-[168px] rounded-2xl border border-line-soft bg-surface p-3.5 shadow-card">
        <View className="flex-row items-start justify-between">
          <TutorAvatar gender={tutor.gender} photoUrl={tutor.photoUrl} name={`${tutor.firstName} ${tutor.lastName}`} size={56} radius={16} />
          {/* Le prix guide la lecture : en haut à droite, en gras. */}
          {offer ? <Text className="text-[15px] font-bold font-display text-primary">{offer.priceLabel}</Text> : null}
        </View>
        <View className="mt-3 flex-row items-center gap-1.5">
          <Text className="shrink text-[14.5px] font-bold text-ink" numberOfLines={1}>
            {tutor.firstName} {tutor.lastName}
          </Text>
          {tutor.isVerified ? <VerifiedBadgeIcon size={14} /> : null}
        </View>
        <Text className="mt-[1px] text-[12.5px] text-ink-soft" numberOfLines={1}>
          {tutor.subjects[0] ?? ""}
        </Text>
        <View className="mt-2 flex-row items-center gap-1">
          <LocationIcon size={12} />
          <Text className="flex-1 text-[12px] text-ink-faint" numberOfLines={1}>
            {tutor.location.label}
          </Text>
        </View>
        <View className="mt-2.5 flex-row">
          {tutor.reviewCount > 0 ? (
            <View className="flex-row items-center gap-1 rounded-full bg-warning-tint px-2 py-[3px]">
              <StarIcon size={12} color="#D4890A" filled />
              <Text className="text-[12px] font-bold text-ink">{tutor.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <View className="rounded-full bg-accent-tint px-2.5 py-[3px]">
              <Text className="text-[12px] font-semibold text-accent">{t("apprentiDashboard.dashboard.noRatingYet")}</Text>
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
}
