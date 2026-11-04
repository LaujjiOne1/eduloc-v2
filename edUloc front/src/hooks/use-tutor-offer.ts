import { useCallback, useState } from "react";

import { useLoadEffect } from "@/hooks/use-load-effect";
import { t } from "@/i18n";
import { OfferService } from "@/services/offer.service";
import type { OfferState } from "@/hooks/use-offer";

/**
 * Une offre du tuteur connecté, avec les durées réservables déduites de ses plages (ce que la fiche publique ne porte pas).
 * Même forme d'état que `useOffer`.
 */
export function useTutorOffer(id: string | undefined) {
  const [state, setState] = useState<OfferState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!id) {
      setState({ status: "error", message: t("hooks.useOffer.thisOfferCouldNotBe") });
      return;
    }
    setState({ status: "loading" });
    try {
      setState({ status: "success", offer: await OfferService.getTutorOfferById(id) });
    } catch {
      setState({ status: "error", message: t("hooks.useOffer.unableToLoadThisOffer") });
    }
  }, [id]);

  useLoadEffect(load);

  return { state, retry: load };
}
