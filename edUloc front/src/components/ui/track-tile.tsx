import { Text, View } from "react-native";

import { BookOpenIcon, CalculatorIcon, CheckIcon, GlobeIcon, LevelIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { type TrackFamily, trackFamilyOf } from "@/lib/search-funnel";
import type { AcademicTrack } from "@/types/track";

const FAMILY_STYLE: Record<TrackFamily, { bg: string; color: string; Icon: typeof LevelIcon }> = {
  science: { bg: "bg-primary-tint", color: "#332E86", Icon: CalculatorIcon },
  literature: { bg: "bg-violet-tint", color: "#6B5BD0", Icon: BookOpenIcon },
  society: { bg: "bg-accent-tint", color: "#0E9C82", Icon: GlobeIcon },
  other: { bg: "bg-paper-alt", color: "#585B78", Icon: LevelIcon },
};

type TrackTileProps = {
  track: AcademicTrack;
  selected: boolean;
  onPress: () => void;
};

/** Série du lycée en tuile : une icône qui la fait reconnaître (calculatrice, livre, globe) puis son nom. */
export function TrackTile({ track, selected, onPress }: TrackTileProps) {
  const { bg, color, Icon } = FAMILY_STYLE[trackFamilyOf(track.code)];
  return (
    <PressableScale onPress={onPress} accessibilityLabel={track.label} >
      <View
        className={[
          "min-h-[104px] justify-between rounded-2xl border p-3.5",
          selected ? "border-primary bg-primary-tint" : "border-line bg-surface shadow-card",
        ].join(" ")}
      >
        <View className="flex-row items-start justify-between">
          <View className={["h-[40px] w-[40px] items-center justify-center rounded-xl", selected ? "bg-surface" : bg].join(" ")}>
            <Icon size={21} color={color} />
          </View>
          {selected ? (
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
              <CheckIcon size={11} color="#fff" />
            </View>
          ) : null}
        </View>
        <Text className="mt-3 text-[15px] font-bold text-ink" numberOfLines={2}>
          {track.label}
        </Text>
      </View>
    </PressableScale>
  );
}
