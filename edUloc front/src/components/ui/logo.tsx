import { Text, View } from "react-native";

import { GraduationCapIcon } from "@/components/icons";

type LogoProps = {
  /** Fond de marque (#332E86) : « edU » passe en blanc et « loc » en violet accent. */
  inverted?: boolean;
  /** Taille de l'emblème en px ; le mot-symbole et les rayons suivent. */
  size?: number;
  /** Emblème seul, sans le mot-symbole. */
  iconOnly?: boolean;
};

/** Logo edUloc de la charte : emblème (mortier dans un carré adouci, fond primaire teinté) + mot-symbole bicolore. */
export function Logo({ inverted, size = 36, iconOnly }: LogoProps) {
  return (
    <View className="flex-row items-center" style={{ gap: size * 0.28 }} accessibilityRole="image" accessibilityLabel="edUloc">
      <View
        className={["items-center justify-center", inverted ? "bg-white/[0.14]" : "bg-primary-tint"].join(" ")}
        style={{ width: size, height: size, borderRadius: size * 0.28 }}
      >
        <GraduationCapIcon size={size * 0.66} color={inverted ? "#FFFFFF" : "#332E86"} />
      </View>
      {iconOnly ? null : (
        <Text className="font-display text-ink" style={{ fontSize: size * 0.58, lineHeight: size * 0.74 }}>
          <Text className={inverted ? "text-white" : "text-ink"}>edU</Text>
          <Text className={inverted ? "text-violet" : "text-primary"}>loc</Text>
        </Text>
      )}
    </View>
  );
}
