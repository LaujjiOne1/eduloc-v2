import * as Haptics from "expo-haptics";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SearchIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";
import { useLevels } from "@/hooks/use-levels";
import { type SubjectsState, useSubjects } from "@/hooks/use-subjects";
import { useTracks } from "@/hooks/use-tracks";
import { allowsFreeTextSubject, isFunnelComplete, subjectsFor } from "@/lib/search-funnel";
import { type SearchWizardCriteria, useSearchWizardStore } from "@/store/search-wizard.store";
import { LevelStep } from "./level-step";
import { SearchStepCard } from "./search-step-card";
import { SubjectStep } from "./subject-step";
import { TrackStep } from "./track-step";

const RESULTS_ROUTE = "/results" as Href;

type StepId = "level" | "track" | "subject";

/** Première étape pas encore renseignée (null quand tout l'est) : c'est elle qui s'ouvre. */
function firstIncompleteStep(criteria: SearchWizardCriteria): StepId | null {
  if (!criteria.level) return "level";
  if (criteria.level.trackKind && !criteria.track) return "track";
  if (!criteria.subject) return "subject";
  return null;
}

type SearchFunnelProps = {
  /** « scolaire » ou « universitaire » : ouvre directement le bloc de niveaux correspondant. */
  cycle?: string;
  onClose: () => void;
  /** Marge sous le bouton « Rechercher » (zone sûre quand la feuille touche le bas de l'écran). */
  footerPadding?: number;
};

/**
 * Recherche en un seul bloc : Niveau → Filière (selon le niveau) → Matière, en cartes dépliables. Choisir une option
 * replie la carte et ouvre la suivante ; une carte repliée garde son choix visible et se rouvre d'un geste. Pour qui,
 * où et l'objectif ne sont demandés qu'à la réservation (booking-wizard.store).
 *
 * Utilisé à l'identique par la feuille `/search` et par les barres de recherche qui s'allongent sur place (accueil,
 * espace demandeur) : mêmes étapes, mêmes choix, mêmes règles.
 */
export function SearchFunnel({ cycle, onClose, footerPadding = 16 }: SearchFunnelProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const criteria = useSearchWizardStore((s) => s.criteria);
  const setLevel = useSearchWizardStore((s) => s.setLevel);
  const setTrack = useSearchWizardStore((s) => s.setTrack);
  const setSubject = useSearchWizardStore((s) => s.setSubject);
  const reset = useSearchWizardStore((s) => s.reset);
  const { level, track, subject } = criteria;

  const levels = useLevels();
  const tracks = useTracks(level?.trackKind ?? null, level?.label);
  const catalog = useSubjects();

  const [active, setActive] = useState<StepId | null>(() => firstIncompleteStep(criteria));
  const [isNavigating, setIsNavigating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, []),
  );

  const trackKind = level?.trackKind ?? null;
  const subjectsState: SubjectsState =
    catalog.state.status === "success"
      ? (() => {
          const categories = subjectsFor(catalog.state.categories, level, track);
          return categories.length > 0 ? { status: "success", categories } : { status: "empty" };
        })()
      : catalog.state;

  /** Après un choix, la carte suivante s'ouvre ; si tout est renseigné, toutes se replient. */
  const advance = () => {
    void Haptics.selectionAsync();
    setActive(firstIncompleteStep(useSearchWizardStore.getState().criteria));
  };

  const clearAll = () => {
    reset();
    setActive("level");
  };

  const launchSearch = () => {
    if (isNavigating || !isFunnelComplete(criteria)) return;
    setIsNavigating(true);
    router.push(RESULTS_ROUTE);
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
        <Text className="text-[26px] font-bold font-display text-ink">{t("search.sheet.title")}</Text>
        <PressableScale onPress={onClose} accessibilityLabel={t("common.close")}>
          <View className="h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/70">
            <XIcon size={16} color="#14162B" />
          </View>
        </PressableScale>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <SearchStepCard
          label={t("search.summary.studyLevel")}
          question={t("common.level")}
          value={level?.label ?? null}
          open={active === "level"}
          onOpen={() => setActive("level")}
        >
          <LevelStep
            state={levels.state}
            selectedId={level?.id ?? null}
            initialBlockId={cycle === "scolaire" ? "primaire" : cycle === "universitaire" ? "licence" : null}
            onRetry={levels.retry}
            onSelect={(next) => {
              setLevel(next);
              advance();
            }}
          />
        </SearchStepCard>

        {trackKind ? (
          <SearchStepCard
            label={trackKind === "serie" ? t("common.track") : t("search.summary.degreeProgramme")}
            question={trackKind === "serie" ? t("common.track") : t("search.summary.degreeProgramme")}
            value={track?.label ?? null}
            open={active === "track"}
            onOpen={() => setActive("track")}
          >
            <TrackStep
              state={tracks.state}
              kind={trackKind}
              selectedId={track?.id ?? null}
              onRetry={tracks.retry}
              onSelect={(next) => {
                setTrack(next);
                advance();
              }}
            />
          </SearchStepCard>
        ) : null}

        <SearchStepCard
          label={t("search.sheet.subject")}
          question={t("search.sheet.subject")}
          value={subject?.label ?? null}
          open={active === "subject"}
          locked={!level || (!!trackKind && !track)}
          onOpen={() => setActive("subject")}
        >
          <SubjectStep
            state={subjectsState}
            freeText={allowsFreeTextSubject(level)}
            onRetry={catalog.retry}
            onSelect={(next) => {
              setSubject(next);
              advance();
            }}
          />
        </SearchStepCard>
      </ScrollView>

      <View
        className="flex-row items-center justify-between border-t border-white/70 px-5 pt-3"
        style={{ paddingBottom: footerPadding, backgroundColor: "rgba(255,255,255,0.6)" }}
      >
        <PressableScale onPress={clearAll} disabled={isNavigating} accessibilityLabel={t("search.summary.resetAllCriteria")}>
          <Text className="text-[14.5px] font-semibold text-ink underline">{t("search.sheet.clearAll")}</Text>
        </PressableScale>
        <Button
          label={t("search.sheet.search")}
          icon={<SearchIcon size={17} color="#fff" />}
          disabled={isNavigating || !isFunnelComplete(criteria)}
          onPress={launchSearch}
        />
      </View>
    </View>
  );
}
