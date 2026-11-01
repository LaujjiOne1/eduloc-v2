import { type Href, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeIn } from "@/components/motion/fade-in";
import { AuthHeader } from "@/components/ui/auth-header";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { PhoneInputField } from "@/components/ui/phone-input-field";
import { TextField } from "@/components/ui/text-field";
import { SocialAuthButtons } from "@/components/ui/social-auth-buttons";
import { useSignupForm } from "@/hooks/use-signup-form";
import { useSocialSignIn } from "@/hooks/use-social-sign-in";
import { routeAfterAuth } from "@/lib/auth-routing";
import { rememberAccount } from "@/lib/device-login";
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/ui/language-selector";

const VERIFY_ROUTE = "/verify" as Href;

export function SignupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setPendingUser = useAuthStore((s) => s.setPendingUser);
  const setUser = useAuthStore((s) => s.setUser);
  const setRememberMe = useAuthStore((s) => s.setRememberMe);

  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    phone,
    setPhone,
    password,
    setPassword,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
    canSubmit,
  } = useSignupForm((user) => {
    setPendingUser(user);
    router.push(VERIFY_ROUTE);
  });

  // Inscription par Google, Apple ou Facebook : le serveur crée (ou retrouve) le compte, déjà vérifié : pas de code à saisir.
  const social = useSocialSignIn((user) => {
    setRememberMe(true);
    rememberAccount(user);
    setUser(user);
    router.replace(routeAfterAuth(user));
  });
  const busy = isSubmitting || social.pending !== null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AuthHeader onBack={() => router.back()} right={<LanguageSelector />} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeIn delay={40}>
          <Text className="mb-[6px] text-[25px] font-bold font-display text-ink">{t("screens.signup.createYourAccount")}</Text>
          <Text className="mb-6 text-[14px] text-ink-soft">
            {t("screens.signup.justTheEssentials30Seconds")}</Text>
        </FadeIn>

        <FadeIn delay={100}>
          {formError ?? social.error ? <FormError message={(formError ?? social.error) as string} /> : null}

          <TextField
            label={t("common.firstName")}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Rota"
            autoComplete="given-name"
            textContentType="givenName"
            error={fieldErrors.firstName}
            editable={!isSubmitting}
          />
          <TextField
            label={t("common.lastName")}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Johnson"
            autoComplete="family-name"
            textContentType="familyName"
            error={fieldErrors.lastName}
            editable={!isSubmitting}
          />
          <TextField
            label={t("common.email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("screens.signup.youremailGmailCom")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={fieldErrors.email}
            editable={!isSubmitting}
          />
          <PhoneInputField
            label={t("common.phone")}
            value={phone}
            onChangeText={setPhone}
            error={fieldErrors.phone}
            disabled={isSubmitting}
          />
          <TextField
            label={t("common.password")}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            error={fieldErrors.password}
            editable={!isSubmitting}
          />
        </FadeIn>

              <FadeIn delay={160}>
        <View
          className="mt-2 border-t border-line-soft pt-[14px]"
          style={{ paddingBottom: Math.max(insets.bottom, 22) }}
        >
          <Button
            label={t("screens.signup.createMyAccount")}
            loading={isSubmitting}
            loadingLabel={t("screens.signup.creating")}
            disabled={!canSubmit || busy}
            onPress={submit}
          />
          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line-soft" />
            <Text className="text-[12.5px] text-ink-faint font-body-semibold">{t("screens.login.or")}</Text>
            <View className="h-px flex-1 bg-line-soft" />
          </View>
          <SocialAuthButtons onPress={(provider) => void social.continueWith(provider)} pending={social.pending} disabled={isSubmitting} />
        </View>
      </FadeIn>
      </ScrollView>


    </KeyboardAvoidingView>
  );
}
