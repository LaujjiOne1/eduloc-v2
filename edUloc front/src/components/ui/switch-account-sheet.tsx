import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CheckIcon, LockIcon, PlusIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";
import { routeAfterAuth } from "@/lib/auth-routing";
import { parkForAddAccount, rememberAccount, revokeAllQuickSignIns, switchAccount } from "@/lib/device-login";
import { isVaultAvailable } from "@/lib/device-vault";
import { requestSignOut, signOut } from "@/lib/sign-out";
import { useAuthStore } from "@/store/auth.store";
import { type DeviceAccount, useDeviceAccountsStore } from "@/store/device-accounts.store";
import { useSwitchAccountPromptStore } from "@/store/switch-account-prompt.store";

const LOGIN_ROUTE = "/login" as Href;

function initialsOf(first: string, last: string, email: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase();
}

type AccountRowProps = {
  firstName: string;
  lastName: string;
  email: string;
  caption: string;
  active?: boolean;
  quick?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

function AccountRow({ firstName, lastName, email, caption, active, quick, pending, disabled, onPress }: AccountRowProps) {
  const name = `${firstName} ${lastName}`.trim() || email;
  const content = (
    <View className={["flex-row items-center gap-3 rounded-2xl border p-3", active ? "border-primary bg-primary-tint" : "border-line bg-surface"].join(" ")}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint">
        <Text className="text-[14px] font-bold text-primary">{initialsOf(firstName, lastName, email)}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[14.5px] font-bold text-ink" numberOfLines={1}>{name}</Text>
        <Text className="text-[12.5px] text-ink-soft" numberOfLines={1}>{email}</Text>
      </View>
      {active ? (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
          <CheckIcon size={12} color="#fff" />
        </View>
      ) : (
        <View className={["flex-row items-center gap-1 rounded-full px-2.5 py-1", quick ? "bg-accent-tint" : "bg-paper"].join(" ")}>
          {pending ? <ActivityIndicator size="small" color="#0E9C82" /> : quick ? <LockIcon size={11} color="#0E9C82" /> : null}
          <Text className={["text-[11.5px] font-semibold", quick ? "text-accent" : "text-ink-soft"].join(" ")}>{caption}</Text>
        </View>
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={`${name} — ${caption}`}>
      {content}
    </PressableScale>
  );
}

/**
 * « Changer de compte » sans se déconnecter : les comptes déjà utilisés sur l'appareil, avec reconnexion d'un toucher pour
 * ceux dont le jeton (ou le mot de passe) est gardé dans le coffre. Les autres passent par « Ajouter un compte », qui met
 * le compte courant de côté puis ouvre la connexion. Un lien permet de révoquer d'un coup toutes les connexions gardées.
 */
export function SwitchAccountSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = useSwitchAccountPromptStore((s) => s.visible);
  const close = useSwitchAccountPromptStore((s) => s.close);
  const user = useAuthStore((s) => s.user);
  const accounts = useDeviceAccountsStore((s) => s.accounts);
  const [vaultAvailable, setVaultAvailable] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  // À chaque ouverture, on repart sans message (réglage pendant le rendu : pas d'état modifié dans un effet).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setMessage(null);
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

  const others = accounts.filter((a) => a.id !== user?.id);
  const hasSecrets = accounts.some((a) => a.savedSession || a.savedPassword);
  const busy = pendingId !== null;

  const finishSwitch = (next: NonNullable<typeof user>) => {
    const store = useAuthStore.getState();
    store.setRememberMe(true);
    rememberAccount(next);
    store.setActiveMode("apprenti");
    store.setReturnTo(null);
    store.bumpAccountEpoch(); // la racine repart à neuf : rien du compte précédent ne reste à l'écran
    close();
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {
      // pile déjà à la racine
    }
    router.replace(routeAfterAuth(next));
  };

  const switchTo = async (account: DeviceAccount) => {
    if (!user || busy) return;
    setMessage(null);
    setPendingId(account.id);
    try {
      const result = await switchAccount(account, user);
      if (result.status === "ok") finishSwitch(result.user);
      else if (result.status === "needs_password") setMessage({ tone: "info", text: result.message ?? t("screens.switchAccount.needsPassword") });
      else if (result.status === "error") setMessage({ tone: "error", text: result.message });
    } finally {
      setPendingId(null);
    }
  };

  const addAccount = async () => {
    if (!user || busy) return;
    setPendingId("add");
    try {
      // Mis de côté (non révoqué) pour qu'on puisse y revenir d'un toucher ; sinon déconnexion ordinaire.
      const parked = await parkForAddAccount(user);
      close();
      signOut(router, { revokeSession: !parked });
      setTimeout(() => router.push(LOGIN_ROUTE), 60);
    } finally {
      setPendingId(null);
    }
  };

  const confirmRevokeAll = () => {
    Alert.alert(t("screens.switchAccount.revokeAllTitle"), t("screens.switchAccount.revokeAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("screens.switchAccount.revokeAllConfirm"),
        style: "destructive",
        onPress: () => {
          void revokeAllQuickSignIns().then((count) => setMessage({ tone: "info", text: t("screens.switchAccount.revokedCount", { count }) }));
        },
      },
    ]);
  };

  return (
    <Modal visible={visible && !!user} transparent animationType="slide" onRequestClose={busy ? undefined : close}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[85%] rounded-t-2xl bg-surface p-5" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[18px] font-bold font-display text-ink">{t("screens.switchAccount.title")}</Text>
            <PressableScale onPress={close} disabled={busy} accessibilityLabel={t("common.close")}>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-paper">
                <XIcon size={16} color="#585B78" />
              </View>
            </PressableScale>
          </View>
          <Text className="mb-4 text-[13px] leading-[19px] text-ink-soft">{t("screens.switchAccount.intro")}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {user ? (
                <AccountRow firstName={user.firstName} lastName={user.lastName} email={user.email} caption={t("screens.switchAccount.active")} active />
              ) : null}
              {others.map((account) => {
                const quick = vaultAvailable && (account.savedSession || account.savedPassword);
                return (
                  <AccountRow
                    key={account.id}
                    firstName={account.firstName}
                    lastName={account.lastName}
                    email={account.email}
                    quick={quick}
                    pending={pendingId === account.id}
                    disabled={busy}
                    caption={quick ? t("screens.login.quickSignIn") : t("screens.switchAccount.passwordRequired")}
                    // Sans reconnexion rapide, le compte ne se retrouve que par la connexion : « Ajouter un compte ».
                    onPress={quick ? () => void switchTo(account) : () => void addAccount()}
                  />
                );
              })}
            </View>
          </ScrollView>

          {message ? (
            <Text className={["mt-3 text-[12.5px] leading-[18px]", message.tone === "error" ? "text-error" : "text-ink-soft"].join(" ")}>{message.text}</Text>
          ) : null}

          {vaultAvailable ? (
            <View className="mt-4 gap-[10px]">
              <Button
                label={t("screens.switchAccount.addAccount")}
                variant="secondary"
                icon={<PlusIcon size={15} color="#332E86" />}
                loading={pendingId === "add"}
                loadingLabel={t("screens.switchAccount.addAccount")}
                disabled={busy}
                onPress={() => void addAccount()}
                fullWidth
              />
              {hasSecrets ? (
                <PressableScale onPress={confirmRevokeAll} disabled={busy} accessibilityLabel={t("screens.switchAccount.revokeAllTitle")}>
                  <Text className="py-2 text-center text-[13px] font-semibold text-error">{t("screens.switchAccount.revokeAllTitle")}</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : (
            // Sans verrouillage d'appareil, rien ne peut être gardé en sécurité : on le dit et on propose la voie ordinaire.
            <View className="mt-4 gap-3">
              <View className="flex-row items-start gap-2 rounded-xl bg-paper p-3">
                <View className="mt-[2px]">
                  <LockIcon size={14} color="#585B78" />
                </View>
                <Text className="flex-1 text-[12.5px] leading-[18px] text-ink-soft">{t("screens.switchAccount.lockRequired")}</Text>
              </View>
              <Button
                label={t("common.logOut")}
                variant="ghost"
                onPress={() => {
                  close();
                  requestSignOut();
                }}
                fullWidth
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
