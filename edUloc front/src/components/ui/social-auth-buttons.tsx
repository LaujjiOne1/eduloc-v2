import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { FacebookIcon, GoogleIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import type { OAuthProvider } from "@/types/auth";

type SocialAuthButtonsProps = {
  onPress: (provider: OAuthProvider) => void;
  /** Fournisseur en cours de connexion : son bouton affiche un indicateur, tous sont bloqués. */
  pending: OAuthProvider | null;
  /** Bloque tout (formulaire en cours d'envoi). */
  disabled?: boolean;
};

type RowProps = { icon: ReactNode; label: string; loading: boolean; disabled: boolean; onPress: () => void };

/** Une ligne « Continuer avec … » : pilule à bordure fine, logo du fournisseur à gauche, libellé centré. */
function Row({ icon, label, loading, disabled, onPress }: RowProps) {
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} accessibilityLabel={label}>
      <View className="h-[52px] flex-row items-center justify-center rounded-full border border-line bg-surface px-5">
        <View className="absolute left-5 h-6 w-6 items-center justify-center">
          {loading ? <ActivityIndicator size="small" color="#332E86" /> : icon}
        </View>
        <Text className="text-[15px] text-ink font-body-semibold">{label}</Text>
      </View>
    </PressableScale>
  );
}

/**
 * Connexion / inscription par Google ou Facebook (Meta), identiques sur les écrans de connexion et d'inscription :
 * le même bouton sert à se connecter et à créer son compte (le serveur lie ou crée).
 *
 * Apple n'est PAS affiché : il demande le programme développeur payant (99 $/an). Le serveur le gère déjà ; pour le remettre,
 * ajouter ici une ligne `provider="apple"` (AppleIcon + clé `screens.login.continueWithApple`) et enregistrer son adaptateur dans
 * lib/social-auth-native.ts. Règle de l'App Store : une application iOS qui propose Google ou Facebook doit aussi proposer Apple.
 */
export function SocialAuthButtons({ onPress, pending, disabled = false }: SocialAuthButtonsProps) {
  const { t } = useTranslation();
  const blocked = disabled || pending !== null;
  return (
    <View className="gap-[10px]">
      <Row icon={<GoogleIcon size={20} />} label={t("screens.login.continueWithGoogle")} loading={pending === "google"} disabled={blocked} onPress={() => onPress("google")} />
      <Row icon={<FacebookIcon size={20} />} label={t("screens.login.continueWithFacebook")} loading={pending === "facebook"} disabled={blocked} onPress={() => onPress("facebook")} />
    </View>
  );
}
