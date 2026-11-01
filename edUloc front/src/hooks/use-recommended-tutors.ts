import { useCallback, useState } from "react";

import { useDevicePosition } from "@/hooks/use-device-position";
import { useLoadEffect } from "@/hooks/use-load-effect";
import { usePopularCategories } from "@/hooks/use-popular-categories";
import { TutorService } from "@/services/tutor.service";
import type { Tutor } from "@/types/tutor";

export type RecommendedTutorsState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "success"; tutors: Tutor[] };

/** Nombre de matières populaires essayées avant de renoncer (la recherche publique exige une matière). */
const SUBJECTS_TRIED = 3;
const MAX_TUTORS = 8;

/**
 * Tuteurs mis en avant sur l'accueil de l'apprenant. La recherche publique exige une matière : on prend les tuteurs de la
 * première matière populaire qui en a. Autour de la position de l'appareil quand elle est déjà connue ; sans elle, en
 * ligne (la position n'est jamais demandée à l'ouverture de l'écran : `requestPosition` est lié à un geste).
 * Pas de message d'erreur : ce bloc est un confort, son échec le masque simplement.
 */
export function useRecommendedTutors() {
  const [state, setState] = useState<RecommendedTutorsState>({ status: "loading" });
  const { state: position, request: requestPosition } = useDevicePosition();
  const { state: popular } = usePopularCategories();

  const load = useCallback(async () => {
    if (popular.status === "loading") return;
    if (popular.status !== "success") {
      setState({ status: "empty" });
      return;
    }
    setState({ status: "loading" });
    const coordinates = position.status === "ready" ? { latitude: position.latitude, longitude: position.longitude } : null;
    try {
      for (const category of popular.categories.filter((c) => !c.freeText).slice(0, SUBJECTS_TRIED)) {
        const tutors = await TutorService.searchTutors({ subjectId: category.id, coordinates, format: coordinates ? "both" : "online" });
        if (tutors.length > 0) {
          setState({ status: "success", tutors: tutors.slice(0, MAX_TUTORS) });
          return;
        }
      }
      setState({ status: "empty" });
    } catch {
      setState({ status: "empty" });
    }
  }, [popular, position]);

  useLoadEffect(load);

  return {
    state,
    nearby: position.status === "ready",
    placeLabel: position.status === "ready" ? position.label : null,
    requestPosition,
    positionLoading: position.status === "loading",
  };
}
