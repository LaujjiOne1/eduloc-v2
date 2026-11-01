import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useReducedMotion,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SearchFunnel } from "./search-funnel";

/** Courbe douce de l'ouverture (cubic-bezier(0.16, 1, 0.3, 1)), comme le reste des animations d'apparition. */
const SOFT_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const OPEN_MS = 460;
const CLOSE_MS = 320;
/** Rayon une fois déployée : une carte, plus une pilule. */
const EXPANDED_RADIUS = 26;
const EXPANDED_BACKGROUND = "#F1F5F9";

type ExpandingSearchProps = {
  open: boolean;
  onClose: () => void;
  collapsedHeight: number;
  /** Hauteur déployée : le bloc grandit de `collapsedHeight` à cette valeur, vers le bas. */
  expandedHeight: number;
  /** Rayon replié (moitié de la hauteur pour une pilule). */
  collapsedRadius: number;
  /** « scolaire » ou « universitaire » : ouvre directement le bloc de niveaux correspondant. */
  cycle?: string;
  /** Ce que l'on voit replié : fond et libellé compris. C'est à lui de réagir au toucher (il ouvre la recherche). */
  collapsed: ReactNode;
  /** Position, marges et ombre du bloc. */
  style?: StyleProp<ViewStyle>;
  /** Pulsation douce quand le bloc est replié (comme le bouton du splash) : elle invite à toucher, et s'arrête à l'ouverture. */
  pulse?: boolean;
};

/**
 * La barre « Que recherchez-vous ? » qui s'allonge sur place : au lieu d'ouvrir une feuille par-dessus l'écran, le bloc
 * lui-même grandit vers le bas et contient le formulaire de recherche (`SearchFunnel`, identique à la feuille `/search`).
 * Le contenu replié s'efface pendant que le formulaire apparaît ; à la fermeture, le formulaire est démonté une fois le
 * bloc revenu à sa taille.
 */
export function ExpandingSearch({ open, onClose, collapsedHeight, expandedHeight, collapsedRadius, cycle, collapsed, style, pulse = false }: ExpandingSearchProps) {
  const progress = useSharedValue(0);
  const breathe = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  // Monté dès l'ouverture (jamais avant : les listes de niveaux et de matières ne se chargent qu'à ce moment-là).
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      progress.set(withTiming(1, { duration: OPEN_MS, easing: SOFT_OUT }));
    } else {
      progress.set(
        withTiming(0, { duration: CLOSE_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [open, progress]);

  // Pulsation : 1 → 1,03 → 1 en boucle de 2 s, seulement replié (elle s'efface au fur et à mesure que le bloc s'ouvre).
  useEffect(() => {
    if (pulse && !open && !reducedMotion) {
      breathe.set(
        withDelay(
          900,
          withRepeat(withSequence(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })), -1, false),
        ),
      );
    } else {
      cancelAnimation(breathe);
      breathe.set(withTiming(0, { duration: 200 }));
    }
  }, [pulse, open, reducedMotion, breathe]);

  const shape = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.get() * (1 - progress.get()) * 0.03 }],
    height: interpolate(progress.get(), [0, 1], [collapsedHeight, expandedHeight]),
    borderRadius: interpolate(progress.get(), [0, 1], [collapsedRadius, EXPANDED_RADIUS]),
  }));
  const surface = useAnimatedStyle(() => ({
    borderRadius: interpolate(progress.get(), [0, 1], [collapsedRadius, EXPANDED_RADIUS]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], ["#FFFFFF", EXPANDED_BACKGROUND]),
  }));
  const collapsedStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.35], [1, 0], "clamp") }));
  const expandedStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0.3, 0.75], [0, 1], "clamp") }));

  return (
    // Style et non className : les composants animés ne reçoivent pas les classes Tailwind (voir FadeIn, ExpandableCard).
    <Animated.View style={[style, shape]}>
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" }, surface]}>
        {/* Replié : calé en haut à sa hauteur d'origine, il s'efface sans glisser pendant que le bloc grandit. */}
        <Animated.View
          pointerEvents={open ? "none" : "auto"}
          style={[{ position: "absolute", top: 0, left: 0, right: 0, height: collapsedHeight }, collapsedStyle]}
        >
          {collapsed}
        </Animated.View>

        {/* Déployé : mis en page à sa hauteur finale dès le départ, pour que rien ne se recompose pendant la croissance. */}
        {mounted ? (
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
            style={[{ position: "absolute", top: 0, left: 0, right: 0, height: expandedHeight }, expandedStyle]}
          >
            <SearchFunnel cycle={cycle} onClose={onClose} footerPadding={16} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
