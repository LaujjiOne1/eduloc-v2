import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type ExpoBlurModule = typeof import("expo-blur");

/**
 * expo-blur est un module natif : dans un build qui ne l'embarque pas encore (ancien development build, Expo Go), le
 * require échoue. On retombe alors sur une simple teinte translucide plus opaque, sans flou : l'écran reste lisible.
 */
function loadBlur(): ExpoBlurModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement tolérant à un module natif absent du build
    return require("expo-blur") as ExpoBlurModule;
  } catch {
    return null;
  }
}
const blur = loadBlur();

type GlassSurfaceProps = {
  /** Teinte du verre (rgba) : la couleur de fond actuelle, rendue translucide. */
  tint: string;
  /** Teinte utilisée sans flou : plus couvrante, faute de pouvoir adoucir ce qui passe derrière. */
  fallbackTint?: string;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Surface en verre dépoli (glassmorphism) : le contenu situé derrière est flouté, voilé de `tint`. Le liseré clair de la tranche se pose sur le style de l'appelant. */
export function GlassSurface({ tint, fallbackTint = tint, intensity = 45, style, children }: GlassSurfaceProps) {
  const BlurView = blur?.BlurView;
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      {BlurView ? <BlurView intensity={intensity} tint="light" blurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BlurView ? tint : fallbackTint }]} />
      {children}
    </View>
  );
}
