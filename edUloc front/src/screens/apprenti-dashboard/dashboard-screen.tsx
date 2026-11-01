import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CalendarIcon, ChevronRightIcon, PersonIcon, SearchIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { PressableScale } from "@/components/motion/pressable-scale";
import { AppHeader, APP_HEADER_BASE_HEIGHT } from "@/components/ui/app-header";
import { ApprentiBottomNav } from "@/components/ui/apprenti-bottom-nav";
import { DayTimetable } from "@/components/ui/day-timetable";
import { GreetingBanner } from "@/components/ui/greeting-banner";
import { Logo } from "@/components/ui/logo";
import { NotificationBell } from "@/components/ui/notification-bell";
import { TutorStories } from "@/components/ui/tutor-stories";
import { useConversations } from "@/hooks/use-conversations";
import { useMyBeneficiaries } from "@/hooks/use-my-beneficiaries";
import { useMyBookings } from "@/hooks/use-my-bookings";
import { useRecommendedTutors } from "@/hooks/use-recommended-tutors";
import { addDays, startOfWeek, toIsoDate } from "@/lib/week";
import { useAuthStore } from "@/store/auth.store";
import { useSearchWizardStore } from "@/store/search-wizard.store";
import { useTranslation } from "react-i18next";
import { ExpandingSearch } from "../search/expanding-search";

/** Hauteur du bouton « Trouver un tuteur » replié (celle d'un bouton plein : 14 px de marge + ligne de texte + 14 px). */
const FIND_TUTOR_HEIGHT = 50;
const MODE_SWITCH_ROUTE = "/mode-switch" as Href;
// The saved-beneficiaries address book (34_Beneficiaries) — not to be
// confused with the in-flow src/app/beneficiary.tsx booking wizard step.
const BENEFICIARIES_ROUTE = "/beneficiaries" as Href;
const BOOKINGS_ROUTE = "/apprenti-dashboard/bookings" as Href;

/** Sans toucher à l'écran pendant ce temps, le haut (salutation, recherche, tuteurs) se range tout seul vers le haut. */
const IDLE_STOW_MS = 15_000;
/** Une fois rangé, les tuiles se collent presque au bord de l'en-tête (un léger souffle les en sépare). */
const STOW_BREATHING_PX = 6;
/** Au plus deux messages par affichage : utile, pas bavard. */
const MAX_MESSAGES = 2;

function bookingRoute(id: string): Href {
  return `/apprenti-dashboard/bookings/${id}` as Href;
}

/**
 * Ordre de lecture : en-tête, salutation animée, recherche, tuteurs (stories), raccourcis en duo (cours de la semaine,
 * bénéficiaires), puis l'emploi du temps de la journée.
 */
export function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Barre du haut flottante (verre) : le contenu démarre juste dessous et défile sous elle.
  const [headerHeight, setHeaderHeight] = useState(insets.top + APP_HEADER_BASE_HEIGHT);
  const { state: bookingsState } = useMyBookings();
  const { state: conversationsState } = useConversations();
  const { state: beneficiariesState } = useMyBeneficiaries();
  const recommended = useRecommendedTutors();
  const firstName = useAuthStore((s) => s.user?.firstName) ?? "";
  const resetSearchWizard = useSearchWizardStore((s) => s.reset);

  // La salutation se rejoue à chaque fois que l'écran reprend le premier plan (retour d'un autre écran, de l'arrière-plan).
  const [playKey, setPlayKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setPlayKey((n) => n + 1);
    }, []),
  );
  const [openedAt] = useState(() => new Date());

  // Haut de l'écran (jusqu'aux tuiles) qui se range seul après 15 s sans toucher, ou quand on le pousse vers le haut.
  const scrollRef = useRef<ScrollView>(null);
  const [topHeight, setTopHeight] = useState(0);
  const offsetY = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stowedOffset = Math.max(0, topHeight - STOW_BREATHING_PX);

  const stowFrame = useRef<number | null>(null);
  const searchOpenRef = useRef(false);

  /**
   * Défilement doux vers `to` : courbe lente au départ et à l'arrivée, durée proportionnelle à la distance. Le défilement animé
   * natif d'Android est trop sec pour ce rangement automatique ; on le déroule image par image, et un toucher l'interrompt.
   */
  const glideTo = useCallback((to: number, minMs = 900) => {
    if (stowFrame.current !== null) cancelAnimationFrame(stowFrame.current);
    const from = offsetY.current;
    const duration = Math.min(1600, Math.max(minMs, Math.abs(to - from) * 3.2));
    const startedAt = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - startedAt) / duration);
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      scrollRef.current?.scrollTo({ y: from + (to - from) * eased, animated: false });
      stowFrame.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    stowFrame.current = requestAnimationFrame(step);
  }, []);

  const cancelIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    // Un doigt posé arrête aussi un rangement en cours.
    if (stowFrame.current !== null) cancelAnimationFrame(stowFrame.current);
    stowFrame.current = null;
  }, []);
  const armIdle = useCallback(() => {
    cancelIdle();
    // Recherche déployée : le haut ne doit surtout pas se ranger sous les doigts de l'utilisateur.
    if (stowedOffset <= 0 || searchOpenRef.current) return;
    idleTimer.current = setTimeout(() => {
      // Seulement s'il est encore déployé : sinon l'utilisateur lit déjà plus bas.
      if (offsetY.current < stowedOffset - 4) glideTo(stowedOffset);
    }, IDLE_STOW_MS);
  }, [cancelIdle, glideTo, stowedOffset]);

  // Armé à l'affichage et dès que la hauteur du haut est connue ; coupé quand l'écran perd le premier plan.
  useFocusEffect(
    useCallback(() => {
      armIdle();
      return cancelIdle;
    }, [armIdle, cancelIdle]),
  );

  /** Le doigt a lâché : si le haut est à moitié rangé, on l'achève (vers le haut ou vers le bas), puis le minuteur repart. */
  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      offsetY.current = y;
      if (stowedOffset > 0 && y > 8 && y < stowedOffset - 8) {
        glideTo(y > stowedOffset / 2 ? stowedOffset : 0, 500);
      }
      armIdle();
    },
    [armIdle, glideTo, stowedOffset],
  );

  const bookings = useMemo(() => (bookingsState.status === "success" ? bookingsState.bookings : []), [bookingsState]);
  const conversations = useMemo(() => (conversationsState.status === "success" ? conversationsState.conversations : []), [conversationsState]);

  // Cours de la semaine en cours (lundi → dimanche) : confirmés, en cours ou terminés. Les demandes en attente se comptent à part.
  const weekStart = startOfWeek(openedAt);
  const weekEnd = addDays(weekStart, 7);
  const lessonsThisWeek = bookings.filter((b) => {
    if (b.status !== "confirmed" && b.status !== "in_progress" && b.status !== "completed") return false;
    const start = new Date(b.slot.startAt);
    return start >= weekStart && start < weekEnd;
  }).length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  // Messages du tiroir, du plus important au moins important ; à défaut, une invitation à apprendre.
  const messages = useMemo(() => {
    const list: string[] = [];
    if (pendingCount > 0) list.push(t("apprentiDashboard.greeting.pending", { count: pendingCount }));
    const next = [...bookings]
      .filter((b) => b.status === "confirmed" && new Date(b.slot.startAt).getTime() >= openedAt.getTime())
      .sort((a, b) => a.slot.startAt.localeCompare(b.slot.startAt))[0];
    if (next) {
      const tomorrow = toIsoDate(addDays(openedAt, 1));
      list.push(
        next.slot.date === toIsoDate(openedAt)
          ? t("apprentiDashboard.greeting.nextLessonToday", { time: next.slot.startTime })
          : next.slot.date === tomorrow
            ? t("apprentiDashboard.greeting.nextLessonTomorrow", { time: next.slot.startTime })
            : t("apprentiDashboard.greeting.nextLessonOn", { day: next.slot.dateLabel, time: next.slot.startTime }),
      );
    }
    if (lessonsThisWeek > 0) list.push(t("apprentiDashboard.greeting.lessonsWeek", { count: lessonsThisWeek }));
    const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    if (unread > 0) list.push(t("apprentiDashboard.greeting.unread", { count: unread }));
    if (list.length === 0) list.push(t("apprentiDashboard.greeting.learnToday"));
    return list.slice(0, MAX_MESSAGES);
  }, [bookings, conversations, lessonsThisWeek, openedAt, pendingCount, t]);

  // La recherche s'allonge sur place : le bouton « Trouver un tuteur » grandit et contient le formulaire (comme à l'accueil).
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBlockY = useRef(0);
  const goToSearch = () => {
    resetSearchWizard();
    searchOpenRef.current = true;
    cancelIdle();
    setSearchOpen(true);
    // Le bloc se cale juste sous la barre du haut, pour que le formulaire soit visible en entier.
    glideTo(searchBlockY.current, 500);
  };
  const closeSearch = useCallback(() => {
    searchOpenRef.current = false;
    setSearchOpen(false);
    armIdle();
  }, [armIdle]);
  // Retour Android : referme la recherche avant de quitter l'écran.
  useEffect(() => {
    if (!searchOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSearch();
      return true;
    });
    return () => subscription.remove();
  }, [searchOpen, closeSearch]);
  const { height: windowHeight } = useWindowDimensions();
  const searchExpandedHeight = Math.round(windowHeight * 0.72);

  return (
    <View className="flex-1 bg-paper">
      <AppHeader onHeight={setHeaderHeight}>
        <Logo size={32} />
        <View className="flex-row items-center gap-[10px]">
          <PressableScale onPress={() => router.push(MODE_SWITCH_ROUTE)} accessibilityLabel={t("apprentiDashboard.dashboard.switchModeLearner")}>
            <View className="flex-row items-center gap-[6px] rounded-full bg-primary-tint py-[7px] pl-[10px] pr-3">
              <PersonIcon size={15} color="#332E86" />
              <Text className="text-[13px] font-bold text-primary">{t("common.learner")}</Text>
              <View style={{ transform: [{ rotate: "90deg" }] }}>
                <ChevronRightIcon size={13} color="#332E86" />
              </View>
            </View>
          </PressableScale>
          <NotificationBell />
        </View>
      </AppHeader>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, paddingTop: headerHeight + 6 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          offsetY.current = event.nativeEvent.contentOffset.y;
        }}
        onTouchStart={cancelIdle}
        onTouchEnd={armIdle}
        onScrollBeginDrag={cancelIdle}
        onScrollEndDrag={settle}
        onMomentumScrollEnd={settle}
      >
        <View onLayout={(event) => setTopHeight(Math.round(event.nativeEvent.layout.height))}>
        {/* Salutation animée : le prénom, « Bonjour » qui le pousse, puis des messages utiles qui s'effacent. */}
        <FadeIn delay={30}>
          <GreetingBanner
            name={firstName}
            hello={t("apprentiDashboard.greeting.hello")}
            messages={messages}
            playKey={playKey}
            open
            ready={bookingsState.status !== "loading" && conversationsState.status !== "loading"}
          />
          <View className="px-5 pb-5 pt-3" onLayout={(event) => (searchBlockY.current = Math.max(0, event.nativeEvent.layout.y))}>
            <ExpandingSearch
              open={searchOpen}
              onClose={closeSearch}
              collapsedHeight={FIND_TUTOR_HEIGHT}
              collapsedRadius={FIND_TUTOR_HEIGHT / 2}
              expandedHeight={searchExpandedHeight}
              style={{ shadowColor: "#332E86", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}
              collapsed={
                <PressableScale onPress={goToSearch} accessibilityLabel={t("common.findATutor")}>
                  <LinearGradient
                    colors={["#211C5E", "#332E86"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ height: FIND_TUTOR_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <SearchIcon size={17} color="#fff" />
                    <Text className="text-[15px] font-semibold text-white">{t("common.findATutor")}</Text>
                  </LinearGradient>
                </PressableScale>
              }
            />
          </View>
        </FadeIn>

        <FadeIn delay={70}>
          <TutorStories bookings={bookings} conversations={conversations} recommended={recommended.state} onFindTutor={goToSearch} />
        </FadeIn>
        </View>

        {/* Raccourcis en duo, 12 px d'écart : cours de la semaine (vocabulaire de l'étude) et bénéficiaires. */}
        <FadeIn delay={100}>
          <View className="mb-7 flex-row gap-3 px-5">
            <ShortcutTile
              icon={<CalendarIcon size={22} color="#4F46E5" />}
              tint="#EEF2FF"
              label={t("apprentiDashboard.dashboard.lessonsThisWeek")}
              figure={
                bookingsState.status === "success"
                  ? lessonsThisWeek > 0
                    ? t("apprentiDashboard.dashboard.lessonsCount", { count: lessonsThisWeek })
                    : t("apprentiDashboard.dashboard.noLessonsShort")
                  : "…"
              }
              caption={pendingCount > 0 ? t("apprentiDashboard.dashboard.pendingShort", { count: pendingCount }) : t("apprentiDashboard.dashboard.managePlanning")}
              onPress={() => router.push(BOOKINGS_ROUTE)}
            />
            <ShortcutTile
              icon={<PersonIcon size={22} color="#7C3AED" />}
              tint="#F5F3FF"
              label={t("apprentiDashboard.dashboard.beneficiaries")}
              figure={beneficiariesState.status === "success" ? t("apprentiDashboard.dashboard.beneficiariesCount", { count: beneficiariesState.beneficiaries.length }) : "…"}
              caption={t("apprentiDashboard.dashboard.linkedStudents")}
              onPress={() => router.push(BENEFICIARIES_ROUTE)}
            />
          </View>
        </FadeIn>

        {/* Emploi du temps : la journée comme dans un calendrier ; en attente = hachuré, confirmé = fond qui se remplit. */}
        <FadeIn delay={160}>
          <View className="mb-6 px-5">
            {bookingsState.status === "loading" ? (
              <View className="h-[160px] rounded-2xl bg-line-soft" />
            ) : bookingsState.status === "error" ? (
              <Text className="text-[13.5px] text-error">{bookingsState.message}</Text>
            ) : (
              <DayTimetable bookings={bookings} onOpenBooking={(id) => router.push(bookingRoute(id))} />
            )}
          </View>
        </FadeIn>
      </ScrollView>

      <ApprentiBottomNav active="home" />
    </View>
  );
}

type ShortcutTileProps = {
  icon: ReactNode;
  /** Fond pastel du carré d'icône. */
  tint: string;
  label: string;
  /** Chiffre clé (« 3 cours », « 2 bénéficiaires »). */
  figure: string;
  caption: string;
  onPress: () => void;
};

function ShortcutTile({ icon, tint, label, figure, caption, onPress }: ShortcutTileProps) {
  return (
    <View className="flex-1">
      <PressableScale onPress={onPress} accessibilityLabel={`${label} — ${figure}`}>
        <View className="min-h-[136px] justify-between rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
          <View className="flex-row items-start justify-between">
            <View className="h-[44px] w-[44px] items-center justify-center rounded-2xl" style={{ backgroundColor: tint }}>
              {icon}
            </View>
            <ChevronRightIcon size={16} color="#9799AF" />
          </View>
          <View className="mt-4">
            <Text className="text-[12.5px] font-semibold text-ink-soft" numberOfLines={1}>{label}</Text>
            <Text className="mt-[1px] text-[18px] font-bold font-display text-ink" numberOfLines={1}>{figure}</Text>
            <Text className="mt-[1px] text-[12px] text-ink-faint" numberOfLines={1}>{caption}</Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}
