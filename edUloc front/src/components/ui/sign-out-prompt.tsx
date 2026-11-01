import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CheckIcon, LockIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";
import { forgetDeviceAccount, forgetSavedPassword, parkCurrentSession, rememberAccount } from "@/lib/device-login";
import { isVaultAvailable } from "@/lib/device-vault";
import { signOut } from "@/lib/sign-out";
import { useAuthStore } from "@/store/auth.store";
import { useDeviceAccountsStore } from "@/store/device-accounts.store";
import { useSignOutPromptStore } from "@/store/sign-out-prompt.store";

type Choice = "keep" | "forget";

type ChoiceRowProps = {
  selected: boolean;
  title: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
};

function ChoiceRow({ selected, title, hint, onPress, disabled }: ChoiceRowProps) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={title} accessibilityRole="checkbox" accessibilityState={{ selected, checked: selected }}>
      <View className={["flex-row items-start gap-3 rounded-2xl border p-4", selected ? "border-primary bg-primary-tint" : "border-line bg-surface"].join(" ")}>
        <View className={["mt-[2px] h-5 w-5 items-center justify-center rounded-full border-2", selected ? "border-primary bg-primary" : "border-line"].join(" ")}>
          {selected ? <CheckIcon size={11} color="#fff" /> : null}
        </View>
        <View className="flex-1">
          <Text className="text-[14.5px] font-bold text-ink">{title}</Text>
          <Text className="mt-[2px] text-[12.5px] leading-[18px] text-ink-soft">{hint}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

type OptionRowProps = {
  checked: boolean;
  title: string;
  hint: string;
  onToggle: () => void;
  disabled?: boolean;
};

/** Sous-option (case carrée) du choix « garder ce compte ». */
function OptionRow({ checked, title, hint, onToggle, disabled }: OptionRowProps) {
  return (
    <PressableScale onPress={onToggle} disabled={disabled} accessibilityLabel={title} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View className="flex-row items-start gap-3 px-1 py-1">
        <View className={["mt-[1px] h-5 w-5 items-center justify-center rounded-[6px] border-2", checked ? "border-primary bg-primary" : "border-line"].join(" ")}>
          {checked ? <CheckIcon size={11} color="#fff" /> : null}
        </View>
        <View className="flex-1">
          <Text className="text-[13.5px] font-semibold text-ink">{title}</Text>
          <Text className="text-[12px] leading-[17px] text-ink-soft">{hint}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Feuille de déconnexion : on demande ce qu'il advient du compte sur CET appareil.
 *  - Garder : le compte reste dans la liste de la connexion. Si l'appareil est verrouillé (empreinte, visage ou code), on
 *    peut en plus mettre de côté le jeton de session (reconnexion d'un toucher, sans mot de passe) et garder le mot de
 *    passe enregistré. Ces secrets vont dans le coffre sécurisé et ne se lisent qu'après déverrouillage.
 *  - Oublier : compte, jeton et mot de passe disparaissent de l'appareil, et la session est révoquée côté serveur.
 */
export function SignOutPrompt() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = useSignOutPromptStore((s) => s.visible);
  const close = useSignOutPromptStore((s) => s.close);
  const user = useAuthStore((s) => s.user);
  const rememberMe = useAuthStore((s) => s.rememberMe);
  const account = useDeviceAccountsStore((s) => s.accounts.find((a) => a.id === user?.id));
  const [choice, setChoice] = useState<Choice>("keep");
  const [oneTap, setOneTap] = useState(true);
  const [keepPassword, setKeepPassword] = useState(true);
  const [vaultAvailable, setVaultAvailable] = useState(false);
  const [pending, setPending] = useState(false);

  // À chaque ouverture : le choix part de ce que l'utilisateur a demandé à la connexion (« rester connecté »).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setChoice(rememberMe ? "keep" : "forget");
      setOneTap(true);
      setKeepPassword(true);
    }
  }
  useEffect(() => {
    if (!visible) return;
    let active = true;
    void isVaultAvailable().then((available) => {
      if (active) setVaultAvailable(available);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  const keep = choice === "keep";
  const hasSavedPassword = !!account?.savedPassword;

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      let parked = false;
      if (user) {
        if (keep) {
          rememberAccount(user);
          // Le jeton mis de côté n'est PAS révoqué à la déconnexion : c'est lui qui permettra de se reconnecter d'un toucher.
          if (vaultAvailable && oneTap) parked = await parkCurrentSession(user.id);
          if (hasSavedPassword && !keepPassword) await forgetSavedPassword(user.id);
        } else {
          await forgetDeviceAccount(user.id);
        }
      }
      close();
      signOut(router, { revokeSession: !parked });
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal visible={visible && !!user} transparent animationType="slide" onRequestClose={pending ? undefined : close}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-2xl bg-surface p-5" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <Text className="text-[18px] font-bold font-display text-ink">{t("screens.signOutPrompt.title")}</Text>
          <Text className="mb-4 mt-1 text-[13.5px] leading-[20px] text-ink-soft">{t("screens.signOutPrompt.intro")}</Text>

          <View className="gap-[10px]">
            <ChoiceRow
              selected={keep}
              disabled={pending}
              title={t("screens.signOutPrompt.keepTitle")}
              hint={t("screens.signOutPrompt.keepHint")}
              onPress={() => setChoice("keep")}
            />
            {keep && vaultAvailable ? (
              <View className="gap-1 px-2">
                <OptionRow
                  checked={oneTap}
                  disabled={pending}
                  title={t("screens.signOutPrompt.oneTapTitle")}
                  hint={t("screens.signOutPrompt.oneTapHint")}
                  onToggle={() => setOneTap(!oneTap)}
                />
                {hasSavedPassword ? (
                  <OptionRow
                    checked={keepPassword}
                    disabled={pending}
                    title={t("screens.signOutPrompt.keepPasswordTitle")}
                    hint={t("screens.signOutPrompt.keepPasswordHint")}
                    onToggle={() => setKeepPassword(!keepPassword)}
                  />
                ) : null}
              </View>
            ) : null}
            <ChoiceRow
              selected={!keep}
              disabled={pending}
              title={t("screens.signOutPrompt.forgetTitle")}
              hint={t("screens.signOutPrompt.forgetHint")}
              onPress={() => setChoice("forget")}
            />
          </View>

          <View className="mb-5 mt-4 flex-row items-start gap-2 rounded-xl bg-paper p-3">
            <View className="mt-[2px]">
              <LockIcon size={14} color="#585B78" />
            </View>
            <Text className="flex-1 text-[12.5px] leading-[18px] text-ink-soft">
              {vaultAvailable
                ? hasSavedPassword
                  ? t("screens.signOutPrompt.vaultTip")
                  : t("screens.signOutPrompt.vaultTipNoPassword")
                : t("screens.signOutPrompt.passwordTip")}
            </Text>
          </View>

          <View className="flex-row gap-[10px]">
            <Button label={t("common.cancel")} variant="ghost" fullWidth disabled={pending} onPress={close} />
            <Button label={t("screens.signOutPrompt.confirm")} fullWidth loading={pending} loadingLabel={t("screens.signOutPrompt.confirm")} onPress={() => void confirm()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
