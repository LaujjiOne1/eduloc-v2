import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import type { BookingStatus } from "@/types/booking";
import { t } from "@/i18n";

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bgClass: string; textClass: string; dotClass: string }
> = {
  pending: { get label() { return t("common.pending"); }, bgClass: "bg-warning-tint", textClass: "text-warning", dotClass: "bg-warning" },
  confirmed: { get label() { return t("ui.statusBadge.confirmed"); }, bgClass: "bg-accent-tint", textClass: "text-accent", dotClass: "bg-accent" },
  refused: { get label() { return t("tutorOnboarding.tutorApplicationPending.rejected"); }, bgClass: "bg-paper-alt", textClass: "text-ink-soft", dotClass: "bg-ink-soft" },
  cancelled: { get label() { return t("ui.statusBadge.cancelled"); }, bgClass: "bg-error-tint", textClass: "text-error", dotClass: "bg-error" },
  in_progress: { get label() { return t("ui.statusBadge.inProgress"); }, bgClass: "bg-primary-tint", textClass: "text-primary", dotClass: "bg-primary" },
  completed: { get label() { return t("ui.statusBadge.completed"); }, bgClass: "bg-paper-alt", textClass: "text-ink-soft", dotClass: "bg-ink-soft" },
};

/** Point orange qui pulse doucement : « en attente », donc quelque chose bouge. */
function PulseDot({ color }: { color: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1100 }), -1, true));
  }, [pulse]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.55 - pulse.get() * 0.5, transform: [{ scale: 1 + pulse.get() * 1.1 }] }));
  return (
    <View style={{ width: 9, height: 9, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: color }, haloStyle]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

/** Classe de la pastille de couleur d'un statut (à poser sur l'avatar du tuteur). */
export function statusDotClass(status: BookingStatus): string {
  return (STATUS_CONFIG[status] ?? STATUS_CONFIG.pending).dotClass;
}

/** Pill matching the EduLoc .badge-pending/.badge-confirmed/... styles for each BookingStatus. */
export function StatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  // En attente : pastille blanche cernée d'ambre vif et point pulsé, bien plus lisible que l'ancien beige pâle.
  if (status === "pending") {
    return (
      <View className="flex-row items-center gap-[7px] self-start rounded-full border border-warning bg-surface px-[11px] py-[5px]">
        <PulseDot color="#F59E0B" />
        <Text className="text-[12px] font-bold text-[#9A5F06]">{config.label}</Text>
      </View>
    );
  }
  return (
    <View
      className={[
        "flex-row items-center gap-[6px] self-start rounded-full px-[11px] py-[5px]",
        config.bgClass,
      ].join(" ")}
    >
      <View className={["h-[7px] w-[7px] rounded-full", config.dotClass].join(" ")} />
      <Text className={["text-[12px] font-semibold", config.textClass].join(" ")}>{config.label}</Text>
    </View>
  );
}
