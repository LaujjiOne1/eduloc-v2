import { type Href, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, type LayoutChangeEvent, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeftIcon, ListIcon, MapIcon, SearchIcon, SlidersIcon, StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { MapLibreResultsMap } from "@/components/map/maplibre-results-map";
import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/ui/empty-state";
import { PressableScale } from "@/components/motion/pressable-scale";
import { AuthHeader } from "@/components/ui/auth-header";
import { DraggableSheet, type SheetSnap } from "@/components/ui/draggable-sheet";
import { ResultsLoginGate } from "@/components/ui/results-login-gate";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import { type Rect, TutorCarousel } from "@/components/ui/tutor-carousel";
import { TutorDetailOverlay } from "@/components/ui/tutor-detail-overlay";
import { type TutorsState, useTutorSearch } from "@/hooks/use-tutor-search";
import { useAuthStore } from "@/store/auth.store";
import { useSearchWizardStore } from "@/store/search-wizard.store";
import type { Tutor } from "@/types/tutor";
import { useTranslation } from "react-i18next";

function tutorRoute(id: string): Href {
  return `/results/tutor/${id}` as Href;
}

function offerRoute(id: string): Href {
  return `/results/offer/${id}` as Href;
}

/** Hauteur de la barre flottante du haut (retour + résumé de la recherche), sous la zone sûre. */
const TOP_BAR_HEIGHT = 64;
/** Partie de la feuille visible quand elle est réduite : poignée, titre et bouton « Liste ». */
const PEEK_VISIBLE = 132;

const FLOATING_SHADOW = {
  shadowColor: "#14162B",
  shadowOpacity: 0.14,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
} as const;

/**
 * Résultats façon Airbnb : la carte occupe l'écran et la liste des tuteurs se glisse par-dessus (réduite, à moitié,
 * plein écran). Le bouton flottant bascule entre « Liste » et « Carte ». Sans position (cours en ligne seulement), il
 * n'y a rien à placer sur la carte : la liste s'ouvre d'emblée à plein écran.
 */
export function ResultsScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const criteria = useSearchWizardStore((s) => s.criteria);
  const { state, retry, origin, originLabel, locationNotice } = useTutorSearch(criteria);

  // Visiteur non connecté : le SERVEUR ne lui renvoie que le nombre de tuteurs (état « restricted », seulement s'il y en a) ;
  // on le lui annonce et on propose de se connecter pour les voir. Sans résultat, il voit l'écran habituel (« aucun tuteur »).
  const pathname = usePathname();
  const setReturnTo = useAuthStore((s) => s.setReturnTo);
  const goAuth = (route: string) => {
    setReturnTo(pathname as Href); // on revient sur les résultats après la connexion
    router.push(route as Href);
  };

  // Position choisie par l'utilisateur ; tant qu'il n'a pas touché à la feuille, elle s'ouvre à moitié, ou à plein
  // écran quand les résultats sont arrivés sans position (rien à voir sur la carte, cours en ligne seulement).
  const [pickedSnap, setSnap] = useState<SheetSnap | null>(null);
  const snap: SheetSnap = pickedSnap ?? (state.status !== "loading" && !origin ? "full" : "half");
  const [selectedMapTutorId, setSelectedMapTutorId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  // Tuteur dont les détails sont déployés par-dessus la liste, et la carte d'où ils sont partis.
  const [expanded, setExpanded] = useState<{ tutor: Tutor; from: Rect | null } | null>(null);

  const tutors = state.status === "success" ? state.tutors : [];
  const selectedMapTutor = tutors.find((t) => t.id === selectedMapTutorId) ?? null;

  // Titre court (la matière) puis sous-titre discret (niveau • lieu) : la ligne ne tronque plus.
  const summaryTitle = criteria.subject?.label ?? criteria.level?.label ?? "";
  const summarySubtitle = [criteria.subject ? criteria.level?.label : null, originLabel ?? tr("common.online")]
    .filter(Boolean)
    .join(" • ");
  const count = state.status === "success" ? tr("common.resultCount", { count: state.tutors.length }) : null;

  if (state.status === "restricted") {
    return (
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        <AuthHeader onBack={() => router.back()} />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }} showsVerticalScrollIndicator={false}>
          <ResultsLoginGate
            count={state.count}
            onLogin={() => goAuth("/login")}
            onSignup={() => goAuth("/signup")}
          />
        </ScrollView>
      </View>
    );
  }

  const topOffset = insets.top + TOP_BAR_HEIGHT;
  const peekVisible = PEEK_VISIBLE + insets.bottom;
  const onLayout = (event: LayoutChangeEvent) => setContainerHeight(event.nativeEvent.layout.height);

  return (
    <View className="flex-1 bg-paper-alt" onLayout={onLayout}>
      {/* Carte plein écran, sous la barre du haut et la feuille. */}
      <View className="absolute inset-0 overflow-hidden bg-paper-alt">
        {state.status === "loading" ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#332E86" />
            <Text className="mt-2 text-[13.5px] text-ink-soft">{tr("results.results.searching")}</Text>
          </View>
        ) : tutors.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-[14px] text-ink-soft">
              {state.status === "error" ? state.message : tr("results.results.noTutorToShowOn")}
            </Text>
          </View>
        ) : (
          <MapLibreResultsMap
            tutors={tutors}
            selectedTutorId={selectedMapTutor?.id ?? null}
            onSelectTutor={(tutor) => {
              setSelectedMapTutorId(tutor.id);
              setSnap("peek");
            }}
            searchLocationQuery={originLabel ?? ""}
            origin={origin}
          />
        )}
      </View>

      {/* Barre flottante : retour + résumé de la recherche (toucher le résumé rouvre les critères). */}
      <View className="absolute left-0 right-0 flex-row items-center gap-3 px-4" style={{ top: insets.top + 8 }}>
        <PressableScale onPress={() => router.back()} accessibilityLabel={tr("common.back")}>
          <View className="h-12 w-12 items-center justify-center rounded-full border border-line bg-surface" style={FLOATING_SHADOW}>
            <ArrowLeftIcon color="#14162B" />
          </View>
        </PressableScale>
        <View className="flex-1">
          <PressableScale onPress={() => router.back()} accessibilityLabel={tr("search.summary.editACriterion")}>
            <View className="h-12 flex-row items-center gap-[10px] rounded-full border border-line-soft bg-surface pl-4 pr-2" style={FLOATING_SHADOW}>
              <SearchIcon size={16} color="#332E86" />
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-bold leading-[17px] text-ink" numberOfLines={1}>
                  {summaryTitle}
                </Text>
                <Text className="text-[11.5px] leading-[14px] text-ink-soft" numberOfLines={1}>
                  {summarySubtitle}
                </Text>
              </View>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint">
                <SlidersIcon size={16} color="#332E86" />
              </View>
            </View>
          </PressableScale>
        </View>
      </View>

      {/* Aperçu du tuteur touché sur la carte, juste au-dessus de la feuille réduite. */}
      {selectedMapTutor && snap === "peek" ? (
        <FadeIn delay={0} style={{ position: "absolute", left: 16, right: 16, bottom: peekVisible + 12 }}>
          <MapTutorPreview tutor={selectedMapTutor} onPress={() => router.push(tutorRoute(selectedMapTutor.id))} />
        </FadeIn>
      ) : null}

      <DraggableSheet
        snap={snap}
        onSnapChange={setSnap}
        fullHeight={Math.max(containerHeight - topOffset, 0)}
        peekVisible={peekVisible}
        bottomInset={insets.bottom}
        header={
          <View className="items-center px-5 pb-3 pt-2">
            <View className="mb-3 h-[5px] w-11 rounded-full bg-line" />
            <Text className="text-[14.5px] font-bold text-ink">{count ?? tr("results.results.searching")}</Text>
          </View>
        }
      >
        {locationNotice && state.status !== "loading" ? (
          <View className="mb-3 flex-row items-center gap-3 rounded-lg bg-paper-alt px-3 py-2.5">
            <Text className="flex-1 text-[12.5px] text-ink-soft">{locationNotice}</Text>
            <PressableScale onPress={retry} accessibilityLabel={tr("results.results.retryWithMyPosition")}>
              <Text className="text-[12.5px] font-bold text-primary">{tr("common.tryAgain")}</Text>
            </PressableScale>
          </View>
        ) : null}
        <TutorList state={state} onRetry={retry} onChangeSearch={() => router.back()} onExpand={(tutor, from) => setExpanded({ tutor, from })} />
      </DraggableSheet>

      {/* Bouton flottant : « Liste » ouvre la feuille à fond, « Carte » la réduit pour libérer la carte. */}
      <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ bottom: Math.max(insets.bottom, 12) + 16 }}>
        <PressableScale
          onPress={() => setSnap(snap === "full" ? "peek" : "full")}
          accessibilityLabel={snap === "full" ? tr("results.results.map") : tr("results.results.list")}
        >
          <View
            className="flex-row items-center gap-2 rounded-full border border-line-soft bg-surface px-5 py-3"
            style={{ shadowColor: "#1E1B4B", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}
          >
            {snap === "full" ? <MapIcon size={16} color="#332E86" /> : <ListIcon size={16} color="#332E86" />}
            <Text className="text-[14px] font-bold text-ink">
              {snap === "full" ? tr("results.results.map") : tr("results.results.list")}
            </Text>
          </View>
        </PressableScale>
      </View>

      {expanded ? (
        <TutorDetailOverlay
          tutor={expanded.tutor}
          from={expanded.from}
          onClose={() => setExpanded(null)}
          onSelectOffer={(offerId) => router.push(offerRoute(offerId))}
          onOpenProfile={() => router.push(tutorRoute(expanded.tutor.id))}
        />
      ) : null}
    </View>
  );
}

function MapTutorPreview({ tutor, onPress }: { tutor: Tutor; onPress: () => void }) {
  const { t: tr } = useTranslation();
  const offer = tutor.offers[0];
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${tutor.firstName} ${tutor.lastName}`}>
      <View
        className="rounded-3xl border border-line-soft bg-surface p-4"
        style={{ shadowColor: "#1E1B4B", shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}
      >
        <View className="flex-row items-center gap-3">
          <TutorAvatar gender={tutor.gender} photoUrl={tutor.photoUrl} name={`${tutor.firstName} ${tutor.lastName}`} size={56} radius={16} />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="shrink text-[16px] font-bold font-display text-ink" numberOfLines={1}>
                {tutor.firstName} {tutor.lastName}
              </Text>
              {tutor.isVerified ? <VerifiedBadgeIcon size={15} /> : null}
            </View>
            <Text className="text-[12.5px] text-ink-soft" numberOfLines={1}>
              {tutor.subjects[0]}
              {" • "}
              {tutor.location.distanceKm != null
                ? tr("results.results.km", { label: tutor.location.label, distanceKm: tutor.location.distanceKm })
                : tutor.location.label}
            </Text>
            <View className="mt-1.5 flex-row items-center">
              {tutor.reviewCount > 0 ? (
                <View className="flex-row items-center gap-1">
                  <StarIcon size={12} color="#D4890A" filled />
                  <Text className="text-[12.5px] font-bold text-ink">{tutor.rating.toFixed(1)}</Text>
                  <Text className="text-[12px] text-ink-soft">({tutor.reviewCount})</Text>
                </View>
              ) : (
                <View className="rounded-full bg-accent-tint px-2.5 py-[3px]">
                  <Text className="text-[11.5px] font-semibold text-accent">{tr("results.results.newTutor")}</Text>
                </View>
              )}
            </View>
          </View>
          {offer ? (
            <View className="items-end">
              <Text className="text-[16px] font-bold font-display text-primary">{offer.priceLabel}</Text>
              <Text className="text-[11.5px] text-ink-faint">{offer.durationLabel}</Text>
            </View>
          ) : null}
        </View>
        <View className="mt-3.5 flex-row items-center justify-center rounded-full bg-primary py-3">
          <Text className="text-[14.5px] font-bold text-white">{tr("results.results.book")}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

type TutorListProps = {
  state: TutorsState;
  onRetry: () => void;
  /** Sortie de l'impasse « aucun résultat » : retour à la recherche pour la modifier. */
  onChangeSearch: () => void;
  onExpand: (tutor: Tutor, from: Rect | null) => void;
};

function TutorList({ state, onRetry, onChangeSearch, onExpand }: TutorListProps) {
  const { t: tr } = useTranslation();
  if (state.status === "loading") {
    return (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-[112px] rounded-lg bg-line-soft" />
        ))}
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-[13.5px] text-error">{state.message}</Text>
        <PressableScale
          onPress={onRetry}
          accessibilityLabel={tr("results.results.tryLoadingTheTutorsAgain")}
        >
          <Text className="text-[13.5px] font-semibold text-primary">{tr("common.tryAgain")}</Text>
        </PressableScale>
      </View>
    );
  }

  if (state.status === "empty") {
    return (
      <EmptyState
        illustration="search"
        title={tr("results.results.noTutorTitle")}
        message={tr("results.results.noTutorHint")}
        actionLabel={tr("results.results.changeSearch")}
        onAction={onChangeSearch}
      />
    );
  }

  // Visiteur : l'écran de résultats n'est jamais affiché (la page « connectez-vous » le remplace) ; rien à lister.
  if (state.status === "restricted") return null;

  // Nouvelle liste (autre recherche, nouvelle position) : on remonte le carrousel pour repartir de la 1re carte.
  return <TutorCarousel key={state.tutors.map((tutor) => tutor.id).join("|")} tutors={state.tutors} onExpand={onExpand} />;
}
