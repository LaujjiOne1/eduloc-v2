import { View } from "react-native";

import { ArrowLeftIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

type AuthHeaderProps = {
  onBack: () => void;
  /** Élément affiché à droite de l'en-tête (ex. sélecteur de langue). */
  right?: ReactNode;
  /** « onPhoto » : posé sur une photo foncée (bouton retour en verre clair, logo inversé). */
  variant?: "default" | "onPhoto";
};

/** Back button + EduLoc wordmark, shared by the Login and Signup screens. */
export function AuthHeader({ onBack, right, variant = "default" }: AuthHeaderProps) {
  const onPhoto = variant === "onPhoto";
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 px-5 pb-[14px] pt-[18px]">
      <PressableScale onPress={onBack} accessibilityLabel={t("common.back")}>
        <View className={["h-9 w-9 items-center justify-center rounded-full border", onPhoto ? "border-white/50 bg-white/20" : "border-line"].join(" ")}>
          <ArrowLeftIcon color={onPhoto ? "#FFFFFF" : "#14162B"} />
        </View>
      </PressableScale>
      <Logo size={32} inverted={onPhoto} />
      {right ? <View className="ml-auto">{right}</View> : null}
    </View>
  );
}
