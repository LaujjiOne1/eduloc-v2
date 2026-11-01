import { type Href, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEffect, useState } from "react";
import { CheckIcon, LockIcon, XIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { PressableScale } from "@/components/motion/pressable-scale";
import { AuthHeader } from "@/components/ui/auth-header";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { GlassSurface } from "@/components/ui/glass-surface";
import { TextField } from "@/components/ui/text-field";
import { SocialAuthButtons } from "@/components/ui/social-auth-buttons";
import { useLoginForm } from "@/hooks/use-login-form";
import { useSocialSignIn } from "@/hooks/use-social-sign-in";
import { routeAfterAuth } from "@/lib/auth-routing";
import { discardParkedSession, forgetDeviceAccount, quickSignIn, rememberAccount, rememberPassword, revokeAllQuickSignIns } from "@/lib/device-login";
import { isVaultAvailable } from "@/lib/device-vault";
import { AuthService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import type { AuthenticatedUser } from "@/types/auth";
import { type DeviceAccount, useDeviceAccountsStore } from "@/store/device-accounts.store";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/ui/language-selector";

const SIGNUP_ROUTE = "/signup" as Href;
const VERIFY_ROUTE = "/verify" as Href;
const FORGOT_PASSWORD_ROUTE = "/forgot-password" as Href;
const PARTNER_DASHBOARD_ROUTE = "/partner-dashboard" as Href;

/** Photo du haut de l'écran de connexion. */
const LOGIN_HERO = require("../../assets/images/login-hero.jpg");
/** Fond de la page (--color-paper) : la photo s'y fond en bas. */
const PAPER = "#FAF9F4";
/** De combien la carte en verre remonte sur la photo. */
const CARD_OVERLAP = 72;

type DeviceAccountRowProps = {
  account: DeviceAccount;
  selected: boolean;
  /** Reconnexion rapide possible : un jeton ou un mot de passe est dans le coffre. */
  quick: boolean;
  pending: boolean;
  disabled: boolean;
  onPick: () => void;
  onForget: () => void;
};

/** Un compte déjà utilisé sur l'appareil : initiales, nom, e-mail ; un toucher se reconnecte (ou préremplit l'e-mail), la croix l'oublie. */
function DeviceAccountRow({ account, selected, quick, pending, disabled, onPick, onForget }: DeviceAccountRowProps) {
  const { t } = useTranslation();
  const initials = `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`.toUpperCase() || account.email.charAt(0).toUpperCase();
  return (
    <View className={["flex-row items-center rounded-2xl border pr-2", selected ? "border-primary bg-primary-tint" : "border-line bg-surface"].join(" ")}>
      <PressableScale onPress={onPick} disabled={disabled} style={{ flex: 1 }} accessibilityLabel={`${account.firstName} ${account.lastName} — ${account.email}`}>
        <View className="flex-row items-center gap-3 p-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-tint">
            <Text className="text-[14px] font-bold text-primary">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[14.5px] font-bold text-ink" numberOfLines={1}>
              {`${account.firstName} ${account.lastName}`.trim() || account.email}
            </Text>
            <Text className="text-[12.5px] text-ink-soft" numberOfLines={1}>
              {account.email}
            </Text>
          </View>
          {quick ? (
            <View className="flex-row items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1">
              {pending ? <ActivityIndicator size="small" color="#0E9C82" /> : <LockIcon size={11} color="#0E9C82" />}
              <Text className="text-[11.5px] font-semibold text-accent">{t("screens.login.quickSignIn")}</Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
      <PressableScale onPress={onForget} disabled={disabled} accessibilityLabel={t("screens.login.forgetAccount", { email: account.email })}>
        <View className="h-8 w-8 items-center justify-center rounded-full">
          <XIcon size={15} color="#9799AF" />
        </View>
      </PressableScale>
    </View>
  );
}

export function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Hauteur de la photo : un tiers de l'écran (bornée), la zone sûre du haut en plus.
  const heroHeight = insets.top + Math.min(340, Math.max(270, Math.round(windowHeight * 0.34)));
  const setUser = useAuthStore((s) => s.setUser);
  const setPendingUser = useAuthStore((s) => s.setPendingUser);
  const setReturnTo = useAuthStore((s) => s.setReturnTo);
  // « Je gère un lieu d'étude » : après connexion (ou inscription + code), on arrive directement sur l'espace lieux partenaires.
  const [partnerIntent, setPartnerIntent] = useState(false);
  const storedRememberMe = useAuthStore((s) => s.rememberMe);
  const setStoredRememberMe = useAuthStore((s) => s.setRememberMe);
  const deviceAccounts = useDeviceAccountsStore((s) => s.accounts);
  // Le coffre n'est proposé que si l'appareil a un verrouillage (empreinte, visage ou code) : sinon, rien n'est enregistré.
  const [vaultAvailable, setVaultAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void isVaultAvailable().then((available) => {
      if (active) setVaultAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);
  const [savePassword, setSavePassword] = useState(false);
  // Compte en cours de reconnexion rapide (déverrouillage + appel serveur) : bloque les autres actions.
  const [quickPendingId, setQuickPendingId] = useState<string | null>(null);

  /** Fin de connexion commune (formulaire ou reconnexion rapide) : mémorise, ouvre la session, navigue. */
  const finishLogin = (user: AuthenticatedUser, remember: boolean) => {
    // Le choix est mémorisé (il redevient le choix par défaut) ; seul un « oui » ajoute le compte à la liste de l'appareil.
    setStoredRememberMe(remember);
    if (remember) rememberAccount(user);
    void discardParkedSession(user.id); // un jeton gardé pour ce compte n'a plus lieu d'être
    setUser(user);
    // Réservation en cours → bénéficiaire ; onboarding tuteur → identité ; sinon l'espace de l'utilisateur.
    router.replace(routeAfterAuth(user));
  };

  const {
    email,
    setEmail,
    password,
    setPassword,
    setFormError,
    rememberMe,
    setRememberMe,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
    canSubmit,
  } = useLoginForm(
    (user, { remember, password: typedPassword }) => {
      finishLogin(user, remember);
      // Mot de passe enregistré seulement si la case est cochée, que la session est gardée et que le coffre est disponible.
      // Après finishLogin : le compte doit déjà figurer dans la liste pour que son indicateur soit mis à jour.
      if (remember && savePassword && vaultAvailable && typedPassword) void rememberPassword(user.id, typedPassword);
    },
    (unverifiedEmail) => {
      // Compte créé mais jamais vérifié : on renvoie un code et on ouvre la saisie.
      setPendingUser({
        id: "",
        firstName: "",
        lastName: "",
        email: unverifiedEmail,
        emailVerified: false,
        status: "pending_verification",
        selfBeneficiaryId: null,
        tutor: null,
        isAdmin: false,
      });
      void AuthService.resendVerification(unverifiedEmail).catch(() => undefined);
      router.push(VERIFY_ROUTE);
    },
    storedRememberMe,
  );

  // Connexion sociale (Google, Apple, Facebook) : même fin de connexion que le formulaire.
  const social = useSocialSignIn((user) => finishLogin(user, rememberMe), rememberMe);

  /** Toucher un compte : reconnexion rapide s'il a un secret dans le coffre, sinon l'e-mail est simplement prérempli. */
  const pickAccount = async (account: DeviceAccount) => {
    setFormError(null);
    if (!vaultAvailable || (!account.savedSession && !account.savedPassword)) {
      setEmail(account.email);
      setPassword("");
      return;
    }
    setQuickPendingId(account.id);
    try {
      const result = await quickSignIn(account);
      if (result.status === "ok") {
        finishLogin(result.user, true);
      } else if (result.status === "needs_password") {
        setEmail(account.email);
        setPassword("");
        if (result.message) setFormError(result.message);
      } else if (result.status === "error") {
        setFormError(result.message);
      }
    } finally {
      setQuickPendingId(null);
    }
  };
  const busy = isSubmitting || quickPendingId !== null || social.pending !== null;
  const confirmRevokeAll = () => {
    Alert.alert(t("screens.switchAccount.revokeAllTitle"), t("screens.switchAccount.revokeAllBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("screens.switchAccount.revokeAllConfirm"), style: "destructive", onPress: () => void revokeAllQuickSignIns() },
    ]);
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-paper" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photo en haut, ajustée à la largeur de l'écran : voile indigo pour la lisibilité, puis fondu vers la couleur de la page. */}
        <View style={{ height: heroHeight }}>
          <Image
            source={LOGIN_HERO}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            contentPosition={{ top: 0, left: "38%" }}
            accessible={false}
          />
          <LinearGradient
            colors={["rgba(33,28,94,0.62)", "rgba(33,28,94,0.34)", PAPER]}
            locations={[0, 0.58, 1]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={{ paddingTop: insets.top }}>
            <AuthHeader onBack={() => router.back()} right={<LanguageSelector />} variant="onPhoto" />
          </View>
          <View className="flex-1 justify-end px-5" style={{ paddingBottom: CARD_OVERLAP + 14 }}>
            <FadeIn delay={40}>
              <Text className="mb-[6px] text-[25px] font-bold font-display text-white" style={{ textShadowColor: "rgba(20,22,43,0.5)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } }}>
                {t("screens.login.signInToContinue")}
              </Text>
              <Text className="text-[14px] text-white/90 font-body" style={{ textShadowColor: "rgba(20,22,43,0.5)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }}>
                {t("screens.login.yourSlotIsHeldFor")}
              </Text>
            </FadeIn>
          </View>
        </View>

        {/* Formulaire en verre dépoli : il chevauche le bas de la photo, qui se devine floutée à travers. */}
        <View className="px-4" style={{ marginTop: -CARD_OVERLAP }}>
          <GlassSurface
            tint="rgba(255,255,255,0.68)"
            fallbackTint="rgba(255,255,255,0.96)"
            intensity={60}
            style={{ borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", padding: 18 }}
          >
          <FadeIn delay={200}>
          {formError ?? social.error ? <FormError message={(formError ?? social.error) as string} /> : null}

          {/* Comptes déjà utilisés sur cet appareil : un toucher remplit l'e-mail (jamais le mot de passe). */}
          {deviceAccounts.length > 0 ? (
            <View className="mb-5">
              <Text className="mb-2 ml-0.5 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft">{t("screens.login.accountsOnDevice")}</Text>
              <View className="gap-2">
                {deviceAccounts.map((account) => (
                  <DeviceAccountRow
                    key={account.id}
                    account={account}
                    selected={email.trim().toLowerCase() === account.email.toLowerCase()}
                    quick={vaultAvailable && (account.savedSession || account.savedPassword)}
                    pending={quickPendingId === account.id}
                    disabled={busy}
                    onPick={() => void pickAccount(account)}
                    onForget={() => void forgetDeviceAccount(account.id)}
                  />
                ))}
              </View>
              {vaultAvailable && deviceAccounts.some((a) => a.savedSession || a.savedPassword) ? (
                <PressableScale onPress={confirmRevokeAll} disabled={busy} accessibilityLabel={t("screens.switchAccount.revokeAllTitle")}>
                  <Text className="mt-2 text-center text-[12.5px] font-semibold text-error">{t("screens.switchAccount.revokeAllTitle")}</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : null}

          {/* « username » + « current-password » : le gestionnaire de mots de passe du téléphone remplit les deux champs et propose d'enregistrer le mot de passe après une connexion réussie. */}
          <TextField
            label={t("common.email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("common.youEmailCom")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            error={fieldErrors.email}
            editable={!isSubmitting}
          />
          <TextField
            label={t("common.password")}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            error={fieldErrors.password}
            editable={!isSubmitting}
          />

          <View className="mb-1 mt-1 flex-row items-center justify-between">
            <PressableScale
              onPress={() => setRememberMe(!rememberMe)}
              disabled={isSubmitting}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              accessibilityLabel={t("screens.login.rememberMe")}
            >
              <View className="flex-row items-center gap-2 py-1">
                <View className={["h-5 w-5 items-center justify-center rounded-[6px] border-2", rememberMe ? "border-primary bg-primary" : "border-line"].join(" ")}>
                  {rememberMe ? <CheckIcon size={11} color="#fff" /> : null}
                </View>
                <Text className="text-[13.5px] text-ink-soft">{t("screens.login.rememberMe")}</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => router.push(FORGOT_PASSWORD_ROUTE)} accessibilityLabel={t("common.forgotPassword")}>
              <Text className="text-right text-[13px] font-semibold text-primary">{t("screens.login.forgotYourPassword")}</Text>
            </PressableScale>
          </View>

          {/* Enregistrer le mot de passe : proposé seulement si l'appareil a un verrouillage (empreinte, visage ou code). */}
          {vaultAvailable && rememberMe ? (
            <PressableScale
              onPress={() => setSavePassword(!savePassword)}
              disabled={isSubmitting}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: savePassword }}
              accessibilityLabel={t("screens.login.savePassword")}
            >
              <View className="mt-1 flex-row items-start gap-2 py-1">
                <View className={["mt-[1px] h-5 w-5 items-center justify-center rounded-[6px] border-2", savePassword ? "border-primary bg-primary" : "border-line"].join(" ")}>
                  {savePassword ? <CheckIcon size={11} color="#fff" /> : null}
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] text-ink-soft">{t("screens.login.savePassword")}</Text>
                  <Text className="text-[12px] leading-[17px] text-ink-faint">{t("screens.login.savePasswordHint")}</Text>
                </View>
              </View>
            </PressableScale>
          ) : null}

          <View className="mt-2">
            <Button
              label={t("common.signIn")}
              loading={isSubmitting}
              loadingLabel={t("screens.login.signingIn")}
              disabled={!canSubmit || quickPendingId !== null || social.pending !== null}
              onPress={submit}
              fullWidth
            />
          </View>

          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line-soft" />
            <Text className="text-[12.5px] text-ink-faint font-body-semibold">{t("screens.login.or")}</Text>
            <View className="h-px flex-1 bg-line-soft" />
          </View>
          <SocialAuthButtons onPress={(provider) => void social.continueWith(provider)} pending={social.pending} disabled={busy} />

          </FadeIn>
          </GlassSurface>
        </View>

        {/* Hors de la carte, sur le fond de page : les liens secondaires. */}
        <View className="px-5">
          <FadeIn delay={260}>
          <View className="mt-[22px] flex-row justify-center">
            <Text className="text-[14px] text-ink-soft">{t("screens.login.donTHaveAnAccount")}</Text>
            <PressableScale onPress={() => router.push(SIGNUP_ROUTE)} accessibilityLabel={t("common.createAnAccount")}>
              <Text className="text-[14px] font-bold text-primary">{t("common.createAnAccount")}</Text>
            </PressableScale>
          </View>

          <View className="mt-4 items-center">
            <PressableScale
              onPress={() => {
                setPartnerIntent(true);
                setReturnTo(PARTNER_DASHBOARD_ROUTE);
              }}
              accessibilityLabel={t("screens.login.iManageAStudyVenue")}
            >
              <Text className="text-[13.5px] font-bold text-primary">{t("screens.login.iManageAStudyVenue")}</Text>
            </PressableScale>
            {partnerIntent ? (
              <Text className="mt-2 text-center text-[12.5px] leading-[18px] text-ink-soft">
                {t("screens.login.signInOrCreateAn")}</Text>
            ) : null}
          </View>
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
