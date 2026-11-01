import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { PressableScale } from "@/components/motion/pressable-scale";
import { BRAND_VIOLET } from "@/lib/brand";

type ButtonVariant = "primary" | "secondary" | "ghost" | "animated" | "light" | "glow";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Submitting state: shows a spinner + loadingLabel and blocks re-taps. */
  loading?: boolean;
  loadingLabel?: string;
  /** "sm" : bouton compact (actions secondaires dans une carte). */
  size?: "md" | "sm";
  /** Halo lumineux autour du bouton (variante « animated » : appel à l'action de l'accueil). */
  animatedGlow?: boolean;
  className?: string;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  animated: "bg-primary-dark",
  secondary: "bg-surface border border-primary",
  ghost: "bg-transparent border border-line",
  // Pilule blanche pour les fonds sombres (carte foncée, splash).
  light: "bg-surface",
  // Dégradé violet → primaire de la charte : l'appel à l'action du splash, sur fond sombre.
  glow: "bg-primary border border-white/25",
};

const VARIANT_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: "text-white",
  animated: "text-white",
  secondary: "text-primary",
  ghost: "text-ink",
  light: "text-primary-dark",
  glow: "text-white",
};

const VARIANT_SPINNER_COLOR: Record<ButtonVariant, string> = {
  primary: "#fff",
  animated: "#fff",
  secondary: "#332E86",
  ghost: "#14162B",
  light: "#211C5E",
  glow: "#fff",
};

/** Rounded pill/box button matching the EduLoc .btn / .btn-primary / .btn-ghost styles. */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  fullWidth,
  disabled,
  loading,
  loadingLabel,
  animatedGlow,
  size = "md",
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      style={fullWidth ? { flex: 1 } : undefined}
    >
      <View
        className={[
          size === "sm"
            ? "flex-row items-center justify-center gap-2 rounded-full px-[16px] py-[9px]"
            : "flex-row items-center justify-center gap-2 rounded-full px-[22px] py-[14px]",
          VARIANT_CLASSES[variant],
          className ?? "",
        ].join(" ")}
        style={animatedGlow ? { shadowColor: variant === "glow" ? "#8D7FE3" : "#332E86", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 } : undefined}
      >
        {variant === "animated" ? (
          // Dégradé de la charte (primaire foncé → primaire) derrière le libellé ; l'ombre teintée vient du conteneur.
          <LinearGradient colors={["#211C5E", "#332E86"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 999 }} />
        ) : null}
        {variant === "glow" ? (
          // Dégradé horizontal à 90° ; le liseré clair le détache du fond indigo.
          <LinearGradient colors={BRAND_VIOLET} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 999 }} />
        ) : null}
        {loading ? <ActivityIndicator size="small" color={VARIANT_SPINNER_COLOR[variant]} /> : icon}
        <Text className={["text-[15px] font-body-semibold", VARIANT_TEXT_CLASSES[variant]].join(" ")}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
      </View>
    </PressableScale>
  );
}
