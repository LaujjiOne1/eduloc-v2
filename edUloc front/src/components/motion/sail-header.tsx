import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useCallback, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BRAND_GRADIENT, BRAND_GRADIENT_END, BRAND_GRADIENT_START } from "@/lib/brand";

/** Durée de l'élévation de la voile. */
const LIFT_MS = 1400;

type UseSailOptions = {
  /** true : écran de démarrage plein écran qui s'élève au toucher ; false : le bandeau est déjà replié. */
  intro: boolean;
};

/** Pilote la voile : `progress` va de 0 (plein écran) à 1 (bandeau replié). Elle ne s'élève qu'au toucher. */
export function useSail({ intro }: UseSailOptions) {
  const progress = useSharedValue(intro ? 0 : 1);
  const [lifted, setLifted] = useState(!intro);

  const lift = useCallback(() => {
    if (progress.get() > 0) return;
    progress.set(
      withTiming(1, { duration: LIFT_MS, // Départ doux, vitesse au milieu, arrivée douce : l'ancienne courbe (très vive au départ) donnait un à-coup.
        easing: Easing.bezier(0.45, 0, 0.2, 1) }, (finished) => {
        if (finished) runOnJS(setLifted)(true);
      }),
    );
  }, [progress]);

  return { progress, lifted, lift };
}

type SailHeaderProps = {
  progress: SharedValue<number>;
  lifted: boolean;
  /** Hauteur du bandeau une fois la voile élevée (zone sûre comprise). */
  compactHeight: number;
  /** Contenu du départ, plein écran (logo, nom, bouton « Commencer »). S'efface pendant l'élévation. */
  expanded: ReactNode;
  /** Contenu du bandeau replié. Apparaît en fin d'élévation. */
  compact: ReactNode;
  /**
   * Opacité du fond du bandeau une fois replié : 0 = transparent (le contenu de la page, par ex. une photo, se voit derrière
   * le logo et le titre), 1 = dégradé plein. Absent : toujours plein. Le splash, lui, reste toujours plein.
   */
  backdrop?: { get: () => number };
};

/**
 * Bandeau de marque qui occupe d'abord tout l'écran puis s'élève comme une voile : son bord inférieur se courbe en
 * montant (le vent), puis se rassemble en bandeau et dévoile le contenu dessous. Elle s'élève quand `useSail().lift` est
 * appelé : c'est le bouton « Commencer » du splash qui le fait.
 */
export function SailHeader({ progress, lifted, compactHeight, expanded, compact, backdrop }: SailHeaderProps) {
  const { height: screenHeight } = useWindowDimensions();

  /** 1 = fond plein (toujours pendant le splash) ; en fin d'élévation il rejoint `backdrop`. */
  const solidity = (p: number) => {
    'worklet';
    return backdrop ? interpolate(p, [0.8, 1], [1, backdrop.get()], 'clamp') : 1;
  };

  const bandStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const solid = solidity(p);
    // Le bord inférieur se gonfle à mi-course (voile qui prend le vent) puis se tend en bandeau.
    const radius = interpolate(p, [0, 0.5, 1], [0, 130, 34]);
    return {
      height: interpolate(p, [0, 1], [screenHeight, compactHeight]),
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
      // Sans fond, ni ombre ni relief : il ne reste que le contenu posé sur la photo.
      backgroundColor: interpolateColor(solid, [0, 1], ['rgba(33,28,94,0)', BRAND_GRADIENT[0]]),
      shadowOpacity: 0.2 * solid,
      elevation: 10 * solid,
    };
  });
  const gradientStyle = useAnimatedStyle(() => ({ opacity: solidity(progress.get()) }));

  const expandedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: interpolate(p, [0, 0.35], [1, 0], "clamp"), transform: [{ translateY: interpolate(p, [0, 1], [0, -90]) }] };
  });

  const compactStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0.6, 1], [0, 1], "clamp") }));

  return (
    // Style et non className : les composants animés ne reçoivent pas les classes Tailwind (voir FadeIn, ExpandableCard).
    <Animated.View
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          overflow: "hidden",
          shadowColor: "#14162B",
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          zIndex: 10,
        },
        bandStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, gradientStyle]} pointerEvents="none">
        <LinearGradient colors={BRAND_GRADIENT} start={BRAND_GRADIENT_START} end={BRAND_GRADIENT_END} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, expandedStyle]} pointerEvents={lifted ? "none" : "box-none"}>
        {expanded}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, compactStyle]} pointerEvents={lifted ? "box-none" : "none"}>
        {compact}
      </Animated.View>
    </Animated.View>
  );
}

/** Style d'apparition pour ce qui doit se révéler quand la voile finit de s'élever (barre flottante, contenu). */
export function useRevealStyle(progress: SharedValue<number>, offset = 40, from = 0.7) {
  return useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: interpolate(p, [from, 1], [0, 1], "clamp"), transform: [{ translateY: interpolate(p, [from, 1], [offset, 0], "clamp") }] };
  });
}
