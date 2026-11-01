import { type Href, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PlusIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import type { RecommendedTutorsState } from "@/hooks/use-recommended-tutors";
import type { Booking } from "@/types/booking";
import type { ConversationSummary } from "@/types/message";
import type { TutorGender } from "@/types/common";

const BUBBLE = 64;
/** Anneau « story » : dégradé violet → corail quand il y a du nouveau (message non lu, créneau confirmé). */
const STORY_RING = ["#6F63DA", "#F2706B"] as const;

function tutorRoute(id: string): Href {
  return `/results/tutor/${id}` as Href;
}

type Contact = {
  id: string;
  name: string;
  gender: TutorGender | null;
  photoUrl: string | null;
  /** Du nouveau : message non lu ou créneau confirmé. */
  fresh: boolean;
};

/** Tuteurs déjà contactés (une bulle par tuteur, le plus récent d'abord), d'après les réservations et les messages. */
function contactsFrom(bookings: Booking[], conversations: ConversationSummary[]): Contact[] {
  const unreadNames = new Set(conversations.filter((c) => c.unreadCount > 0).map((c) => c.counterpartName));
  const seen = new Map<string, Contact>();
  for (const booking of bookings) {
    const { tutorId, tutorName, tutorGender, tutorPhotoUrl } = booking.offer;
    const fresh = booking.status === "confirmed" || unreadNames.has(tutorName);
    const known = seen.get(tutorId);
    if (known) {
      known.fresh = known.fresh || fresh;
      continue;
    }
    seen.set(tutorId, { id: tutorId, name: tutorName, gender: tutorGender, photoUrl: tutorPhotoUrl, fresh });
  }
  return [...seen.values()];
}

type TutorStoriesProps = {
  bookings: Booking[];
  conversations: ConversationSummary[];
  recommended: RecommendedTutorsState;
  /** Ouvre la recherche (bulle « + »). */
  onFindTutor: () => void;
};

/**
 * Rangée « stories » : une première bulle « + Trouver un tuteur » toujours présente, puis les tuteurs déjà contactés (un
 * toucher ouvre leur fiche pour réserver). Sans historique, la rangée propose à la place des profils recommandés, jamais
 * un espace vide.
 */
export function TutorStories({ bookings, conversations, recommended, onFindTutor }: TutorStoriesProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const contacts = useMemo(() => contactsFrom(bookings, conversations), [bookings, conversations]);
  const suggestions = recommended.status === "success" ? recommended.tutors.slice(0, 5) : [];

  if (contacts.length === 0 && recommended.status === "empty") return null;

  const title = contacts.length > 0 ? t("apprentiDashboard.dashboard.myTutors") : t("screens.home.tutorsToDiscover");

  return (
    <View className="mb-6">
      <Text className="mb-3 px-5 text-[17px] font-bold font-display text-ink">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
        <StoryBubble label={t("common.findATutor")} onPress={onFindTutor} variant="add" />

        {contacts.length > 0
          ? contacts.map((contact) => (
              <StoryBubble
                key={contact.id}
                label={contact.name.split(" ")[0] ?? contact.name}
                accessibilityLabel={t("apprentiDashboard.dashboard.openTutor", { tutorName: contact.name })}
                name={contact.name}
                gender={contact.gender}
                photoUrl={contact.photoUrl}
                highlighted={contact.fresh}
                onPress={() => router.push(tutorRoute(contact.id))}
              />
            ))
          : recommended.status === "loading"
            ? [0, 1, 2].map((i) => (
                <View key={i} className="items-center" style={{ width: BUBBLE + 8 }}>
                  <View className="rounded-full bg-line-soft" style={{ width: BUBBLE, height: BUBBLE }} />
                  <View className="mt-2 h-[10px] w-[44px] rounded-full bg-line-soft" />
                </View>
              ))
            : suggestions.map((tutor) => (
                <StoryBubble
                  key={tutor.id}
                  label={tutor.firstName}
                  accessibilityLabel={t("apprentiDashboard.dashboard.openTutor", { tutorName: `${tutor.firstName} ${tutor.lastName}` })}
                  name={`${tutor.firstName} ${tutor.lastName}`}
                  gender={tutor.gender}
                  photoUrl={tutor.photoUrl}
                  badge={t("apprentiDashboard.dashboard.recommendedBadge")}
                  onPress={() => router.push(tutorRoute(tutor.id))}
                />
              ))}
      </ScrollView>
    </View>
  );
}

export type StoryBubbleProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: "tutor" | "add";
  name?: string;
  gender?: TutorGender | null;
  photoUrl?: string | null;
  /** Anneau dégradé (du nouveau) ; sinon anneau gris très doux. */
  highlighted?: boolean;
  /** Pastille posée sur le bas de la photo (« Recommandé »). */
  badge?: string;
};

export function StoryBubble({ label, onPress, accessibilityLabel, variant = "tutor", name, gender, photoUrl, highlighted, badge }: StoryBubbleProps) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel ?? label}>
      <View className="items-center" style={{ width: BUBBLE + 8 }}>
        {variant === "add" ? (
          <View
            className="items-center justify-center rounded-full bg-primary-tint"
            style={{ width: BUBBLE, height: BUBBLE, borderWidth: 2, borderStyle: "dashed", borderColor: "#6F63DA" }}
          >
            <PlusIcon size={24} color="#332E86" />
          </View>
        ) : (
          <View>
            {highlighted ? (
              <LinearGradient
                colors={STORY_RING}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, alignItems: "center", justifyContent: "center" }}
              >
                <AvatarInRing name={name} gender={gender} photoUrl={photoUrl} />
              </LinearGradient>
            ) : (
              <View style={{ width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, alignItems: "center", justifyContent: "center", backgroundColor: "#E2E8F0" }}>
                <AvatarInRing name={name} gender={gender} photoUrl={photoUrl} />
              </View>
            )}
            {badge ? (
              <View className="absolute -bottom-[5px] self-center rounded-full border border-surface bg-accent px-[6px] py-[1px]">
                <Text className="text-[9px] font-bold text-white" numberOfLines={1}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        <Text className="mt-2 text-center text-[12.5px] font-semibold text-ink" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Photo entourée d'un liseré blanc : l'anneau de la story se détache de l'image. */
function AvatarInRing({ name, gender, photoUrl }: { name?: string; gender?: TutorGender | null; photoUrl?: string | null }) {
  return (
    <View className="items-center justify-center rounded-full bg-surface" style={{ width: BUBBLE - 6, height: BUBBLE - 6 }}>
      <TutorAvatar gender={gender} photoUrl={photoUrl} name={name} size={BUBBLE - 12} />
    </View>
  );
}
