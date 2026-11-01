import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { ChevronLeftIcon, ChevronRightIcon, LocationIcon, StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import type { Tutor } from "@/types/tutor";

export const CARD_HEIGHT = 330;
const MAX_CARD_WIDTH = 300;
/** Largeur maximale du panneau de détails : l'image de la carte est dimensionnée pour couvrir les deux. */
export const PANEL_MAX_WIDTH = 480;
/** Part de la largeur de la carte qui sépare deux cartes voisines : en dessous de 1, elles se chevauchent. */
const STEP_RATIO = 0.78;
const SPRING = { damping: 22, stiffness: 160, mass: 1 } as const;
/** Glissement (en pixels, élan compris) à partir duquel on passe à la carte suivante. */
const SWIPE_DISTANCE = 50;
/** Au-delà, des points deviennent trop nombreux : on affiche « 3 sur 12 ». */
const MAX_DOTS = 7;

/** Rectangle en coordonnées de la fenêtre, tel que le rend `measureInWindow`. */
export type Rect = { x: number; y: number; width: number; height: number };

/** Côté de l'image de la carte, identique dans le carrousel et dans le panneau ouvert pour que la transition soit continue. */
export function faceAvatarSize(windowWidth: number): number {
  return Math.max(CARD_HEIGHT, Math.min(windowWidth - 24, PANEL_MAX_WIDTH));
}

function mod(value: number, size: number): number {
  "worklet";
  return ((value % size) + size) % size;
}

/** Écart signé entre la carte `index` et la position (fractionnaire) du carrousel, ramené au plus court chemin du cercle. */
function offsetOf(index: number, position: number, size: number): number {
  "worklet";
  const off = mod(index - position, size);
  return off > size / 2 ? off - size : off;
}

type TutorCarouselProps = {
  tutors: Tutor[];
  /** Carte centrale touchée : `from` est sa position à l'écran (absente au lecteur d'écran), point de départ du panneau de détails. */
  onExpand: (tutor: Tutor, from: Rect | null) => void;
};

/**
 * Résultats de recherche en carrousel 3D : la carte centrale est nette, ses voisines pivotent derrière elle. On
 * parcourt en glissant, avec les flèches ou en touchant une carte voisine ; toucher la carte centrale déploie ses détails.
 * Le défilement est circulaire. Pour une nouvelle liste, remonter le composant avec une `key` (retour à la 1re carte).
 */
export function TutorCarousel({ tutors, onExpand }: TutorCarouselProps) {
  const { t } = useTranslation();
  const n = tutors.length;
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  // `target` : entier non borné (la carte visée, sans retour à zéro) ; `position` : sa version animée, fractionnaire.
  const target = useSharedValue(0);
  const position = useSharedValue(0);

  const cardWidth = Math.min(MAX_CARD_WIDTH, width * 0.72);
  const step = cardWidth * STEP_RATIO;

  const go = (delta: number) => {
    if (n < 2) return;
    const next = target.get() + delta;
    target.set(next);
    position.set(withSpring(next, SPRING));
    setIndex(mod(next, n));
  };

  const goTo = (cardIndex: number) => {
    const delta = offsetOf(cardIndex, target.get(), n);
    if (delta !== 0) go(delta);
  };

  const pan = Gesture.Pan()
    .enabled(n > 1 && step > 0)
    // Un geste surtout vertical reste à la feuille des résultats qui contient le carrousel.
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      position.set(target.get() - event.translationX / step);
    })
    .onEnd((event) => {
      const projected = event.translationX + event.velocityX * 0.12;
      const direction = projected < -SWIPE_DISTANCE ? 1 : projected > SWIPE_DISTANCE ? -1 : 0;
      const next = target.get() + direction;
      target.set(next);
      position.set(withSpring(next, SPRING));
      runOnJS(setIndex)(mod(next, n));
    });

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const current = tutors[index];

  return (
    <View onLayout={onLayout}>
      {width > 0 && n > 0 ? (
        <GestureDetector gesture={pan}>
          <View
            style={{ height: CARD_HEIGHT + 8, overflow: "hidden" }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t("results.results.carouselPosition", { current: index + 1, total: n })}
            accessibilityHint={t("results.results.carouselHint")}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "activate" }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "increment") go(1);
              else if (event.nativeEvent.actionName === "decrement") go(-1);
              else if (current) onExpand(current, null);
            }}
          >
            {tutors.map((tutor, i) => (
              <CarouselCard
                key={tutor.id}
                tutor={tutor}
                index={i}
                count={n}
                position={position}
                width={width}
                cardWidth={cardWidth}
                step={step}
                onPress={(from) => (i === index ? onExpand(tutor, from) : goTo(i))}
              />
            ))}
          </View>
        </GestureDetector>
      ) : (
        <View style={{ height: CARD_HEIGHT + 8 }} />
      )}

      {n > 1 ? (
        <>
          <View className="mt-3 flex-row items-center justify-center gap-4">
            <PressableScale onPress={() => go(-1)} accessibilityLabel={t("results.results.previous")}>
              <View className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surface">
                <ChevronLeftIcon size={18} />
              </View>
            </PressableScale>

            {n <= MAX_DOTS ? (
              <View className="flex-row items-center gap-2">
                {tutors.map((tutor, i) => (
                  <Pressable
                    key={tutor.id}
                    onPress={() => goTo(i)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${tutor.firstName} ${tutor.lastName}`}
                    accessibilityState={{ selected: i === index }}
                  >
                    <View className={`h-2 rounded-full ${i === index ? "w-6 bg-primary" : "w-2 bg-line"}`} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="min-w-[64px] text-center text-[13px] font-bold text-ink">
                {t("results.results.carouselPosition", { current: index + 1, total: n })}
              </Text>
            )}

            <PressableScale onPress={() => go(1)} accessibilityLabel={t("results.results.next")}>
              <View className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surface">
                <ChevronRightIcon size={18} />
              </View>
            </PressableScale>
          </View>
          <Text className="mt-2.5 text-center text-[12px] text-ink-faint">{t("results.results.carouselHint")}</Text>
        </>
      ) : null}
    </View>
  );
}

type CarouselCardProps = {
  tutor: Tutor;
  index: number;
  count: number;
  position: SharedValue<number>;
  width: number;
  cardWidth: number;
  step: number;
  onPress: (from: Rect | null) => void;
};

function CarouselCard({ tutor, index, count, position, width, cardWidth, step, onPress }: CarouselCardProps) {
  const { width: windowWidth } = useWindowDimensions();
  const frameRef = useRef<View>(null);
  const animatedStyle = useAnimatedStyle(() => {
    const off = offsetOf(index, position.get(), count);
    const abs = Math.abs(off);
    return {
      opacity: interpolate(abs, [0, 1, 1.7], [1, 0.9, 0], Extrapolation.CLAMP),
      zIndex: Math.round(100 - abs * 10),
      transform: [
        { perspective: 1200 },
        { translateX: off * step },
        { rotateY: `${off * -38}deg` },
        { scale: 1 - Math.min(abs, 2) * 0.14 },
      ],
    };
  });

  // Le panneau de détails part de l'emplacement exact de la carte touchée.
  const press = () => {
    const frame = frameRef.current;
    if (!frame) return onPress(null);
    frame.measureInWindow((x, y, w, h) => onPress(w > 0 && h > 0 ? { x, y, width: w, height: h } : null));
  };

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: (width - cardWidth) / 2, width: cardWidth, height: CARD_HEIGHT }, animatedStyle]}>
      <Pressable
        ref={frameRef}
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={`${tutor.firstName} ${tutor.lastName}`}
        style={{
          flex: 1,
          borderRadius: 24,
          overflow: "hidden",
          shadowColor: "#14162B",
          shadowOpacity: 0.2,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <TutorFace tutor={tutor} avatarSize={faceAvatarSize(windowWidth)} />
      </Pressable>
    </Animated.View>
  );
}

type TutorFaceProps = {
  tutor: Tutor;
  avatarSize: number;
  /** Style animé de la ligne prix + bouton, que le panneau de détails fait disparaître en s'ouvrant. */
  footerStyle?: ComponentProps<typeof Animated.View>["style"];
  showAction?: boolean;
};

/**
 * Visage d'une carte : photo plein cadre sous un dégradé, nom, matière, note, lieu et prix. Il remplit son parent et est
 * partagé avec le panneau de détails, qui le garde en en-tête : c'est l'élément commun de la transition.
 */
export function TutorFace({ tutor, avatarSize, footerStyle, showAction = true }: TutorFaceProps) {
  const { t } = useTranslation();
  const offer = tutor.offers[0];
  const name = `${tutor.firstName} ${tutor.lastName}`;
  const reason = tutor.matchReasons?.[0];
  const glass = { backgroundColor: "rgba(255,255,255,0.18)" } as const;

  return (
    <View style={{ flex: 1, backgroundColor: "#211C5E", overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }}>
        <TutorAvatar gender={tutor.gender} photoUrl={tutor.photoUrl} name={name} size={avatarSize} radius={0} />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(33,28,94,0)", "rgba(33,28,94,0.55)", "#211C5E"]}
        locations={[0.2, 0.6, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {reason ? (
        <View className="absolute left-3 top-3 max-w-[75%] rounded-full bg-white px-2.5 py-[5px]">
          <Text className="text-[11.5px] font-bold text-primary" numberOfLines={1}>
            {reason}
          </Text>
        </View>
      ) : null}

      <View className="absolute inset-x-0 bottom-0 p-4">
        <View className="flex-row items-center gap-1.5">
          <Text className="shrink text-[19px] font-bold font-display text-white" numberOfLines={1}>
            {name}
          </Text>
          {tutor.isVerified ? <VerifiedBadgeIcon size={16} /> : null}
        </View>
        <Text className="mt-[2px] text-[13px] text-white/85" numberOfLines={1}>
          {tutor.subjects[0] ?? ""}
        </Text>

        <View className="mt-2.5 flex-row items-center gap-2">
          {tutor.reviewCount > 0 ? (
            <View className="flex-row items-center gap-1 rounded-full px-2 py-[3px]" style={glass}>
              <StarIcon size={12} color="#F5B73B" filled />
              <Text className="text-[12px] font-bold text-white">{tutor.rating.toFixed(1)}</Text>
              <Text className="text-[12px] text-white/70">({tutor.reviewCount})</Text>
            </View>
          ) : (
            <View className="rounded-full px-2.5 py-[3px]" style={glass}>
              <Text className="text-[12px] font-semibold text-white">{t("results.results.newTutor")}</Text>
            </View>
          )}
          <View className="min-w-0 flex-1 flex-row items-center gap-1">
            <LocationIcon size={12} color="#FFFFFFB3" />
            <Text className="shrink text-[12px] text-white/70" numberOfLines={1}>
              {tutor.location.distanceKm != null ? `${tutor.location.label}, ${tutor.location.distanceKm} km` : tutor.location.label}
            </Text>
          </View>
        </View>

        <Animated.View style={[{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, footerStyle]}>
          {offer ? (
            <View>
              <Text className="text-[17px] font-bold font-display text-white">{offer.priceLabel}</Text>
              <Text className="text-[11.5px] text-white/70">{offer.durationLabel}</Text>
            </View>
          ) : (
            <View />
          )}
          {showAction ? (
            <View className="rounded-full bg-white px-4 py-2.5">
              <Text className="text-[13px] font-bold text-primary">{t("results.results.viewDetails")}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
