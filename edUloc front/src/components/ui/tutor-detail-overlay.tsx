import { useEffect, useRef, useState } from "react";
import { BackHandler, type LayoutChangeEvent, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ChevronRightIcon, ClockIcon, HouseIcon, VideoIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CARD_HEIGHT, faceAvatarSize, PANEL_MAX_WIDTH, type Rect, TutorFace } from "@/components/ui/tutor-carousel";
import type { Tutor, TutorOfferSummary } from "@/types/tutor";

const OPEN_SPRING = { damping: 26, stiffness: 240, mass: 1 } as const;
/** Fermeture sans rebond : le panneau se pose pile sur la carte. */
const CLOSE_SPRING = { damping: 32, stiffness: 260, mass: 1 } as const;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 500;
const DRAG_RANGE = 300;
const PANEL_MARGIN = 12;
const PANEL_RADIUS_CLOSED = 24;
const PANEL_RADIUS_OPEN = 28;

type TutorDetailOverlayProps = {
  tutor: Tutor;
  /** Position à l'écran de la carte touchée : le panneau s'en déploie et s'y replie. Sans elle, il part du centre. */
  from: Rect | null;
  onClose: () => void;
  onSelectOffer: (offerId: string) => void;
  onOpenProfile: () => void;
};

type OverlayLayout = { width: number; height: number; originX: number; originY: number };

/**
 * Détails d'un tuteur déployés depuis sa carte, sans quitter la liste : la carte grandit en panneau (transition d'élément
 * partagé), garde sa photo en en-tête et révèle dessous les matières, niveaux, formats et offres. Se ferme avec la croix,
 * un toucher sur le fond, le bouton retour d'Android ou un glissement vertical de l'en-tête.
 * À monter en dernier enfant d'un conteneur plein écran : il le recouvre entièrement.
 */
export function TutorDetailOverlay({ tutor, from, onClose, onSelectOffer, onOpenProfile }: TutorDetailOverlayProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [layout, setLayout] = useState<OverlayLayout | null>(null);

  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closing = useSharedValue(false);

  // Mesure du conteneur dans la fenêtre : la carte est mesurée en coordonnées de fenêtre, le panneau se place dans le conteneur.
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const root = rootRef.current;
    if (!root) return setLayout({ width, height, originX: 0, originY: 0 });
    root.measureInWindow((x, y) => setLayout({ width, height, originX: x, originY: y }));
  };

  const ready = layout !== null;
  useEffect(() => {
    if (ready) progress.set(withSpring(1, OPEN_SPRING));
  }, [ready, progress]);

  const requestClose = () => {
    if (closing.get()) return;
    closing.set(true);
    dragY.set(withSpring(0, CLOSE_SPRING));
    progress.set(
      withSpring(0, CLOSE_SPRING, (finished) => {
        if (finished) runOnJS(onClose)();
      }),
    );
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
    // requestClose ne dépend que de valeurs partagées stables et de onClose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      dragY.set(event.translationY);
    })
    .onEnd((event) => {
      if (Math.abs(event.translationY) > DISMISS_DISTANCE || Math.abs(event.velocityY) > DISMISS_VELOCITY) {
        runOnJS(requestClose)();
      } else {
        dragY.set(withSpring(0, OPEN_SPRING));
      }
    });

  // Géométrie de départ (la carte) et d'arrivée (le panneau), dans le repère du conteneur.
  const W = layout?.width ?? 0;
  const H = layout?.height ?? 0;
  const startW = from?.width ?? 300;
  const startH = from?.height ?? CARD_HEIGHT;
  const startX = from ? from.x - (layout?.originX ?? 0) : (W - startW) / 2;
  const startY = from ? from.y - (layout?.originY ?? 0) : (H - startH) / 2;
  const endW = Math.min(W - PANEL_MARGIN * 2, PANEL_MAX_WIDTH);
  const endX = (W - endW) / 2;
  const endY = insets.top + 8;
  const endH = Math.max(H - endY - Math.max(insets.bottom, PANEL_MARGIN), CARD_HEIGHT);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP) *
      interpolate(Math.abs(dragY.get()), [0, DRAG_RANGE], [1, 0.35], Extrapolation.CLAMP),
  }));

  const panelStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      left: interpolate(p, [0, 1], [startX, endX]),
      top: interpolate(p, [0, 1], [startY, endY]),
      width: interpolate(p, [0, 1], [startW, endW]),
      height: interpolate(p, [0, 1], [startH, endH]),
      borderRadius: interpolate(p, [0, 1], [PANEL_RADIUS_CLOSED, PANEL_RADIUS_OPEN]),
      transform: [{ translateY: dragY.get() }, { scale: interpolate(Math.abs(dragY.get()), [0, DRAG_RANGE], [1, 0.92], Extrapolation.CLAMP) }],
    };
  });

  const footerStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP) }));
  const revealStyle = useAnimatedStyle(() => {
    const p = interpolate(progress.get(), [0.55, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 16 }] };
  });

  const firstOffer = tutor.offers[0];
  const name = `${tutor.firstName} ${tutor.lastName}`;

  return (
    <View ref={rootRef} onLayout={onLayout} className="absolute inset-0" accessibilityViewIsModal>
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,8,40,0.72)" }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={requestClose} accessibilityRole="button" accessibilityLabel={t("common.close")} />
      </Animated.View>

      {ready ? (
        <Animated.View
          accessibilityLabel={name}
          style={[
            {
              position: "absolute",
              overflow: "hidden",
              backgroundColor: "#FFFFFF",
              shadowColor: "#000000",
              shadowOpacity: 0.3,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 16,
            },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ height: CARD_HEIGHT }}>
              <TutorFace tutor={tutor} avatarSize={faceAvatarSize(windowWidth)} footerStyle={footerStyle} showAction={false} />
            </View>
          </GestureDetector>

          <Animated.View style={[{ flex: 1 }, revealStyle]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {tutor.nextSlotLabel ? (
                <View className="mb-[18px] flex-row">
                  <View className="flex-row items-center gap-1 rounded-full bg-accent-tint px-3 py-[6px]">
                    <ClockIcon size={13} color="#0E9C82" />
                    <Text className="text-[12.5px] font-semibold text-accent" numberOfLines={1}>
                      {tutor.nextSlotLabel}
                    </Text>
                  </View>
                </View>
              ) : null}

              {tutor.bio ? (
                <Section title={t("common.about")}>
                  <Text className="text-[14.5px] leading-[22px] text-ink-soft">{tutor.bio}</Text>
                </Section>
              ) : null}

              {tutor.subjects.length > 0 ? (
                <Section title={t("results.tutorProfile.subjects")}>
                  <View className="flex-row flex-wrap gap-2">
                    {tutor.subjects.map((subject) => (
                      <Chip key={subject} label={subject} />
                    ))}
                  </View>
                </Section>
              ) : null}

              {tutor.levels.length > 0 ? (
                <Section title={t("results.tutorProfile.levels")}>
                  <Text className="text-[14.5px] font-semibold text-ink">{tutor.levels.join(" • ")}</Text>
                </Section>
              ) : null}

              <Section title={t("results.tutorProfile.formats")}>
                <View className="flex-row gap-[18px]">
                  {tutor.formats.includes("in_person") ? (
                    <View className="flex-row items-center gap-[7px]">
                      <HouseIcon size={16} color="#585B78" />
                      <Text className="text-[14px] font-semibold text-ink">{t("common.inPerson")}</Text>
                    </View>
                  ) : null}
                  {tutor.formats.includes("online") ? (
                    <View className="flex-row items-center gap-[7px]">
                      <VideoIcon size={16} color="#585B78" />
                      <Text className="text-[14px] font-semibold text-ink">{t("common.online")}</Text>
                    </View>
                  ) : null}
                </View>
              </Section>

              {tutor.offers.length > 0 ? (
                <Section title={t("results.tutorProfile.offers")}>
                  {tutor.offers.map((offer) => (
                    <OfferRow key={offer.id} offer={offer} onPress={() => onSelectOffer(offer.id)} />
                  ))}
                </Section>
              ) : null}
            </ScrollView>

            <View className="border-t border-line-soft bg-surface px-5 pb-4 pt-3">
              <Button
                label={t("results.tutorProfile.viewTheOffer")}
                disabled={!firstOffer}
                onPress={() => firstOffer && onSelectOffer(firstOffer.id)}
              />
              <PressableScale onPress={onOpenProfile} accessibilityLabel={t("results.results.fullProfile")}>
                <Text className="pt-3 text-center text-[13.5px] font-bold text-primary">{t("results.results.fullProfile")}</Text>
              </PressableScale>
            </View>
          </Animated.View>

          <Animated.View style={[{ position: "absolute", top: 12, right: 12 }, revealStyle]}>
            <PressableScale onPress={requestClose} accessibilityLabel={t("common.close")}>
              <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.22)" }}>
                <XIcon size={18} color="#FFFFFF" />
              </View>
            </PressableScale>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-[20px]">
      <Text className="mb-[6px] ml-0.5 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft">{title}</Text>
      {children}
    </View>
  );
}

function OfferRow({ offer, onPress }: { offer: TutorOfferSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const formatLabel = offer.formats.map((format) => (format === "online" ? t("common.online") : t("common.inPerson"))).join(" / ");
  return (
    <PressableScale onPress={onPress} accessibilityLabel={offer.title}>
      <View className="mb-[10px] flex-row items-center justify-between rounded-lg border border-line bg-surface p-4 shadow-card">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-bold text-ink">{offer.title}</Text>
          <Text className="mt-[3px] text-[12.5px] text-ink-soft">
            {offer.durationLabel} • {formatLabel}
          </Text>
        </View>
        <Text className="mr-2 text-[15px] font-bold font-display text-primary">{offer.priceLabel}</Text>
        <ChevronRightIcon size={17} color="#9799AF" />
      </View>
    </PressableScale>
  );
}
