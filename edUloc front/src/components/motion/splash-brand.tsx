import { useEffect, useRef } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";

import { LinearGradient } from "expo-linear-gradient";

import { GraduationCapIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BRAND_GLOW } from "@/lib/brand";

/** Courbe douce de l'apparition (cubic-bezier(0.16, 1, 0.3, 1)). */
const SOFT_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Charte : cœur « primaire » (#332E86) et bords « primaire foncé » (#211C5E) : un halo qui attire l'œil vers la marque. */
const CENTER_COLOR = "#332E86";
const EDGE_COLOR = "#211C5E";
/** Charte, fond sombre : « edU » en blanc, « loc » en violet accent (le primaire seul disparaîtrait sur ce fond). */
const VIOLET = "#8D7FE3";
/** Emblème : carré aux angles adoucis (même proportion que le composant Logo), mortier blanc sur voile clair. */
const EMBLEM_SIZE = 84;

/** Temps laissé au bouton pour tomber avant que la voile ne commence à s'élever. */
const DROP_BEFORE_LIFT_MS = 420;

type SplashBrandProps = {
  tagline: string;
  /** Le chargement est terminé : la barre s'efface et le bouton apparaît. */
  ready: boolean;
  startLabel: string;
  /** Appelé quand le bouton est tombé : l'appelant fait s'élever la voile. */
  onStart: () => void;
};

/**
 * Contenu du splash : fond en dégradé radial, pictogramme blanc sans cadre, nom puis slogan qui se dévoilent l'un après
 * l'autre, et une barre de chargement ultra-fine en bas. Le chargement fini, la barre cède la place au bouton « Commencer » ;
 * au toucher, le bouton tombe en bas de l'écran puis la voile s'élève (voir HomeScreen).
 *
 * Chorégraphie : 0 → 0,6 s le pictogramme monte et passe de 0,85 à 1 ; 0,4 → 1,0 s le nom glisse de 10 px ; le slogan suit
 * 150 ms plus tard. Chute du bouton : léger recul vers le haut (120 ms) puis accélération vers le bas, en pivotant.
 */
export function SplashBrand({ tagline, ready, startLabel, onStart }: SplashBrandProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const icon = useSharedValue(0);
  const name = useSharedValue(0);
  const slogan = useSharedValue(0);
  const bar = useSharedValue(0);
  const cta = useSharedValue(0);
  const drop = useSharedValue(0);
  const tilt = useSharedValue(0);
  // Pulsation douce du bouton une fois visible (1 → 1,035 → 1) : il attire l'œil sans clignoter ; coupée au toucher.
  const pulse = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const started = useRef(false);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    icon.set(withTiming(1, { duration: 600, easing: SOFT_OUT }));
    name.set(withDelay(400, withTiming(1, { duration: 600, easing: SOFT_OUT })));
    slogan.set(withDelay(550, withTiming(1, { duration: 600, easing: SOFT_OUT })));
    bar.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, false));
  }, [icon, name, slogan, bar]);

  useEffect(() => {
    if (!ready) return;
    cta.set(withTiming(1, { duration: 520, easing: SOFT_OUT }));
    if (!reducedMotion) {
      pulse.set(
        withDelay(
          900,
          withRepeat(withSequence(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })), -1, false),
        ),
      );
    }
  }, [ready, cta, pulse, reducedMotion]);

  useEffect(
    () => () => {
      if (liftTimer.current) clearTimeout(liftTimer.current);
    },
    [],
  );

  const start = () => {
    if (started.current) return;
    started.current = true;
    cancelAnimation(pulse);
    pulse.set(0);
    drop.set(
      withSequence(
        withTiming(-12, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(height * 0.35, { duration: DROP_BEFORE_LIFT_MS + 100, easing: Easing.in(Easing.cubic) }),
      ),
    );
    tilt.set(withDelay(120, withTiming(9, { duration: DROP_BEFORE_LIFT_MS, easing: Easing.in(Easing.quad) })));
    liftTimer.current = setTimeout(onStart, DROP_BEFORE_LIFT_MS);
  };

  const iconStyle = useAnimatedStyle(() => ({
    opacity: icon.get(),
    transform: [{ scale: 0.85 + icon.get() * 0.15 }, { translateY: (1 - icon.get()) * 12 }],
  }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: name.get(), transform: [{ translateY: (1 - name.get()) * 10 }] }));
  const sloganStyle = useAnimatedStyle(() => ({ opacity: slogan.get() * 0.8, transform: [{ translateY: (1 - slogan.get()) * 8 }] }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -width * 0.4 + bar.get() * width * 1.4 }] }));
  // La barre s'efface quand le bouton apparaît ; le bouton monte de 28 px en s'affichant, puis suit la chute.
  const trackStyle = useAnimatedStyle(() => ({ opacity: 1 - cta.get() }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: cta.get(),
    transform: [{ translateY: (1 - cta.get()) * 28 + drop.get() }, { rotate: `${tilt.get()}deg` }, { scale: 1 + pulse.get() * 0.035 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Fond : dégradé radial centré légèrement au-dessus du milieu, là où se pose la marque. */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="splash-glow" cx="50%" cy="42%" rx="85%" ry="62%" fx="50%" fy="42%">
            <Stop offset="0" stopColor={CENTER_COLOR} />
            <Stop offset="1" stopColor={EDGE_COLOR} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#splash-glow)" />
      </Svg>

      <View style={styles.center}>
        <Animated.View style={iconStyle}>
          <View style={styles.emblem} accessibilityRole="image" accessibilityLabel="edUloc">
            <GraduationCapIcon size={EMBLEM_SIZE * 0.66} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.nameRow, nameStyle]}>
          <Text style={styles.name}>
            edU<Text style={{ color: VIOLET }}>loc</Text>
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, sloganStyle]}>{tagline}</Animated.Text>
      </View>

      {/* Barre de chargement de 1,5 px qui traverse l'écran, jusqu'à la fin du chargement. */}
      <Animated.View style={[styles.track, trackStyle]}>
        {/* Barre en dégradé signature de la charte : primaire → violet éclatant → émeraude. */}
        <Animated.View style={[{ width: width * 0.4, height: 1.5 }, barStyle]}>
          <LinearGradient colors={BRAND_GLOW} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bar} />
        </Animated.View>
      </Animated.View>

      {/* Bouton « Commencer » : prend la place de la barre, puis tombe au toucher. */}
      <Animated.View
        pointerEvents={ready ? "auto" : "none"}
        style={[styles.cta, { bottom: Math.max(insets.bottom, 16) + 28 }, ctaStyle]}
      >
        {/* Dégradé violet → primaire de la charte (sans émeraude), texte blanc : il se détache du fond indigo sans agresser. */}
        <Button label={startLabel} variant="glow" animatedGlow onPress={start} fullWidth />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingBottom: 24 },
  emblem: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: EMBLEM_SIZE * 0.28, height: EMBLEM_SIZE, justifyContent: "center", width: EMBLEM_SIZE },
  nameRow: { marginTop: 18 },
  name: { color: "#FFFFFF", fontFamily: "SpaceGrotesk_700Bold", fontSize: 50, letterSpacing: -1, lineHeight: 56 },
  // Corps de texte : Inter 400 (charte).
  tagline: { color: "#FFFFFF", fontFamily: "Inter_400Regular", fontSize: 15.5, letterSpacing: 0.2, marginTop: 10, maxWidth: 280, textAlign: "center" },
  track: { backgroundColor: "rgba(255,255,255,0.12)", bottom: 44, height: 1.5, left: 0, overflow: "hidden", position: "absolute", right: 0 },
  bar: { height: 1.5, width: "100%" },
  cta: { flexDirection: "row", left: 28, position: "absolute", right: 28 },
});
