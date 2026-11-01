import { type Href, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BellIcon, GraduationCapIcon, HouseIcon, LockIcon, PersonIcon, TeachIcon, VerifiedBadgeIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { AccountActions, ModeCard, SectionLabel, SettingsCard, SettingsRow } from "@/components/ui/account-sections";
import { ApprentiBottomNav } from "@/components/ui/apprenti-bottom-nav";
import { AuthHeader } from "@/components/ui/auth-header";
import { LanguageSelector } from "@/components/ui/language-selector";
import { LessonAlarmCard } from "@/components/ui/lesson-alarm-card";
import { ProfilePhotoEditor } from "@/components/ui/profile-photo-editor";
import { TutorBottomNav } from "@/components/ui/tutor-bottom-nav";
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "react-i18next";

const MODE_SWITCH_ROUTE = "/mode-switch" as Href;
const NOTIFICATIONS_ROUTE = "/notifications" as Href;
const PARTNER_DASHBOARD_ROUTE = "/partner-dashboard" as Href;

/**
 * Profil du demandeur. Même structure que celui du tuteur (my-profile-screen) : carte d'identité, carte de mode, sections
 * étiquetées, paramètres, puis « Changer de compte » et « Déconnexion », assemblés à partir des mêmes blocs
 * (`account-sections`).
 */
export function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = useAuthStore((s) => s.activeMode);
  const user = useAuthStore((s) => s.user);

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const isApprenti = activeMode === "apprenti";
  const openModeSwitch = () => router.push(MODE_SWITCH_ROUTE);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <AuthHeader onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Identité (même carte que celle du tuteur) */}
        <FadeIn delay={30}>
          <View className="mb-5 flex-row items-center rounded-xl border border-line bg-surface p-4 shadow-card">
            <View className="flex-1 flex-row items-center gap-[14px]">
              <ProfilePhotoEditor name={displayName} size={64} />
              <View className="flex-1">
                <Text className="text-[17.5px] font-bold font-display text-ink" numberOfLines={1}>
                  {displayName}
                </Text>
                <Text className="mt-0.5 text-[13px] text-ink-soft" numberOfLines={1}>
                  {user?.email ?? ""}
                </Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* 2. Mode */}
        <FadeIn delay={60}>
          <SectionLabel>{t("common.mode")}</SectionLabel>
          <ModeCard
            icon={isApprenti ? <GraduationCapIcon size={17} color="#332E86" /> : <TeachIcon size={17} color="#332E86" />}
            title={t("screens.account.mode", { value: isApprenti ? t("common.learner") : t("common.tutor") })}
            subtitle={isApprenti ? t("screens.account.learningSpace") : t("tutorDashboard.myProfile.teachingSpace")}
            switchLabel={t("screens.account.switchTo", { value: isApprenti ? t("common.tutor") : t("common.learner") })}
            switchIcon={isApprenti ? <TeachIcon size={14} color="#585B78" /> : <GraduationCapIcon size={14} color="#585B78" />}
            openAccessibilityLabel={t("screens.account.switchModeLabel", { value: isApprenti ? t("common.learner") : t("common.tutor") })}
            switchAccessibilityLabel={t("screens.account.switchTo", { value: isApprenti ? t("common.tutor") : t("common.learner") })}
            onOpen={openModeSwitch}
            onSwitch={openModeSwitch}
          />
        </FadeIn>

        {/* 3. Rappels */}
        <FadeIn delay={90}>
          <SectionLabel>{t("screens.account.reminders")}</SectionLabel>
          <View className="mb-5">
            <LessonAlarmCard />
          </View>
        </FadeIn>

        {/* 4. Paramètres (mêmes lignes que le tuteur, plus « Mes lieux d'étude ») */}
        <FadeIn delay={120}>
          <SectionLabel>{t("common.settings")}</SectionLabel>
          <SettingsCard>
            <SettingsRow
              Icon={PersonIcon}
              label={t("common.personalInformation")}
              onPress={() => {}}
              disabled
              accessibilityLabel={t("screens.account.personalInformationComingSoon")}
            />
            <SettingsRow
              Icon={HouseIcon}
              label={t("screens.account.myStudyVenuesPartner")}
              onPress={() => router.push(PARTNER_DASHBOARD_ROUTE)}
              accessibilityLabel={t("screens.account.manageMyPartnerStudyVenues")}
            />
            <LanguageSelector variant="row" />
            <View className="h-px bg-line-soft" />
            <SettingsRow Icon={BellIcon} label={t("common.notifications")} onPress={() => router.push(NOTIFICATIONS_ROUTE)} />
            <SettingsRow Icon={VerifiedBadgeIcon} label={t("common.privacy")} onPress={() => {}} disabled accessibilityLabel={t("common.privacyComingSoon")} />
            <SettingsRow Icon={LockIcon} label={t("common.security")} onPress={() => {}} disabled last accessibilityLabel={t("common.securityComingSoon")} />
          </SettingsCard>
        </FadeIn>

        {/* 5. Changer de compte, Déconnexion */}
        <FadeIn delay={150}>
          <AccountActions />
        </FadeIn>
      </ScrollView>

      {isApprenti ? <ApprentiBottomNav active="profile" /> : <TutorBottomNav active="profile" />}
    </View>
  );
}
