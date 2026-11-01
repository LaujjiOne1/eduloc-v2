import type { ComponentType, ReactNode } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ChevronRightIcon, type IconProps, LogoutIcon, PersonIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { requestSignOut } from "@/lib/sign-out";
import { requestSwitchAccount } from "@/store/switch-account-prompt.store";

/**
 * Blocs communs des pages de profil (demandeur et tuteur) : mêmes étiquettes, mêmes lignes de paramètres, même carte de
 * mode, mêmes actions de compte. Une page de profil ne redéfinit plus ses propres versions : elle les assemble.
 */

/** Étiquette de section (petites majuscules) au-dessus d'une carte. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft">{children}</Text>;
}

type SettingsRowProps = {
  Icon: ComponentType<IconProps>;
  label: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
  last?: boolean;
  accessibilityLabel?: string;
};

/** Ligne de paramètre : icône, libellé, valeur éventuelle, chevron ; un filet la sépare de la suivante. */
export function SettingsRow({ Icon, label, value, onPress, disabled, last, accessibilityLabel }: SettingsRowProps) {
  return (
    <View>
      <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel ?? label}>
        <View className="flex-row items-center gap-[14px] py-[13px]">
          <Icon size={18} color="#585B78" />
          <Text className="flex-1 text-[14.5px] font-semibold text-ink">{label}</Text>
          {value ? <Text className="mr-1 text-[13px] text-ink-soft">{value}</Text> : null}
          <ChevronRightIcon size={16} color="#9799AF" />
        </View>
      </PressableScale>
      {last ? null : <View className="h-px bg-line-soft" />}
    </View>
  );
}

/** Carte des paramètres : les lignes sont fournies par la page (les siennes d'abord, puis les communes). */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <View className="mb-5 rounded-lg border border-line bg-surface px-4 shadow-card">{children}</View>;
}

type ModeCardProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  /** Libellé du bouton « Passer en … ». */
  switchLabel: string;
  switchIcon: ReactNode;
  openAccessibilityLabel: string;
  switchAccessibilityLabel: string;
  onOpen: () => void;
  onSwitch: () => void;
};

/** Carte du mode actif (Apprenti ou Tuteur) : un toucher ouvre le choix de mode, la pastille bascule directement. */
export function ModeCard({ icon, title, subtitle, switchLabel, switchIcon, openAccessibilityLabel, switchAccessibilityLabel, onOpen, onSwitch }: ModeCardProps) {
  return (
    <PressableScale onPress={onOpen} accessibilityLabel={openAccessibilityLabel}>
      <View className="mb-5 flex-row items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-md bg-primary-tint">{icon}</View>
          <View>
            <Text className="text-[14.5px] font-bold text-ink">{title}</Text>
            <Text className="text-[12px] text-ink-soft">{subtitle}</Text>
          </View>
        </View>
        <PressableScale onPress={onSwitch} accessibilityLabel={switchAccessibilityLabel}>
          <View className="flex-row items-center gap-[6px] rounded-full border border-line bg-surface px-[14px] py-[9px]">
            {switchIcon}
            <Text className="text-[13.5px] font-semibold text-ink-soft">{switchLabel}</Text>
          </View>
        </PressableScale>
      </View>
    </PressableScale>
  );
}

/**
 * « Changer de compte » puis « Déconnexion » : les deux boutons de fin de page, identiques pour tous les comptes.
 * La déconnexion ouvre la feuille « garder / oublier ce compte » (SignOutPrompt, montée à la racine).
 */
export function AccountActions() {
  const { t } = useTranslation();
  return (
    <View>
      <PressableScale onPress={requestSwitchAccount} accessibilityLabel={t("screens.switchAccount.title")}>
        <View className="mb-3 flex-row items-center justify-center gap-[10px] rounded-lg border border-line bg-surface py-3.5 shadow-sm">
          <PersonIcon size={18} color="#332E86" />
          <Text className="text-[15px] font-bold text-primary">{t("screens.switchAccount.title")}</Text>
        </View>
      </PressableScale>
      <PressableScale onPress={requestSignOut} accessibilityLabel={t("common.logOut")}>
        <View className="mb-4 flex-row items-center justify-center gap-[10px] rounded-lg border border-error/20 bg-surface py-3.5 shadow-sm">
          <LogoutIcon size={18} color="#AC4A40" />
          <Text className="text-[15px] font-bold text-error">{t("common.logOut")}</Text>
        </View>
      </PressableScale>
    </View>
  );
}
