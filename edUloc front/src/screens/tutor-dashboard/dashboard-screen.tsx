import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertTriangleIcon, ChevronRightIcon, ClockIcon, HouseIcon, SubjectIcon, TeachIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { PressableScale } from "@/components/motion/pressable-scale";
import { AppHeader, APP_HEADER_BASE_HEIGHT } from "@/components/ui/app-header";
import { Button } from "@/components/ui/button";
import { markersFromOccurrences } from "@/components/ui/day-agenda";
import { HabitCalendar } from "@/components/ui/habit-calendar";
import { Logo } from "@/components/ui/logo";
import { NotificationBell } from "@/components/ui/notification-bell";
import { StoryBubble } from "@/components/ui/tutor-stories";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import { TutorBottomNav } from "@/components/ui/tutor-bottom-nav";
import { TutorDayTimetable } from "@/components/ui/tutor-day-timetable";
import { useConversations } from "@/hooks/use-conversations";
import { useTutorAvailability } from "@/hooks/use-tutor-availability";
import { useTutorBookings } from "@/hooks/use-tutor-bookings";
import { useTutorProfile } from "@/hooks/use-tutor-profile";
import { isTutorSuspended } from "@/lib/auth-routing";
import { addDays, toIsoDate } from "@/lib/week";
import { AvailabilityService } from "@/services/availability.service";
import { useAuthStore } from "@/store/auth.store";
import type { Booking } from "@/types/booking";
import { useTranslation } from "react-i18next";

const MODE_SWITCH_ROUTE = "/mode-switch" as Href;
const APPOINTMENTS_ROUTE = "/tutor-dashboard/appointments" as Href;
const REQUESTS_ROUTE = "/tutor-dashboard/requests" as Href;
const CALENDAR_ROUTE = "/tutor-dashboard/calendar" as Href;
const PROFILE_ROUTE = "/tutor-dashboard/profile" as Href;
const OFFERS_ROUTE = "/tutor-dashboard/offers" as Href;
const ROOMS_ROUTE = "/tutor-dashboard/rooms" as Href;
const newAvailabilityRoute = (date: string) => `/tutor-dashboard/calendar/availability/new?date=${date}` as Href;
const editAvailabilityRoute = (id: string) => `/tutor-dashboard/calendar/availability/${id}` as Href;

function requestRoute(id: string): Href {
  return `/tutor-dashboard/requests/${id}` as Href;
}
function appointmentRoute(id: string): Href {
  return `/tutor-dashboard/appointments/${id}` as Href;
}

/** « Aujourd'hui à 14:00 », « Demain à 14:00 », sinon la date du créneau. */
function lessonCountdown(booking: Booking, t: (key: never, options?: never) => string): string {
  const translate = t as unknown as (key: string, options?: Record<string, string>) => string;
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (booking.slot.date === toIsoDate(today)) return translate("tutorDashboard.dashboard.todayAt", { time: booking.slot.startTime });
  if (booking.slot.date === toIsoDate(tomorrow)) return translate("tutorDashboard.dashboard.tomorrowAt", { time: booking.slot.startTime });
  return `${booking.slot.dateLabel} • ${booking.slot.startTime}`;
}

/**
 * Espace de travail du tuteur : son visage et l'état de son profil, ce qui l'attend (demandes, prochain cours), ses
 * élèves, son planning de la semaine, puis des raccourcis. Un tuteur qui démarre voit une invitation à agir, pas des
 * compteurs à zéro.
 */
export function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Barre du haut flottante (verre) : le contenu démarre juste dessous et défile sous elle.
  const [headerHeight, setHeaderHeight] = useState(insets.top + APP_HEADER_BASE_HEIGHT);
  const { state: profileState } = useTutorProfile();
  const { state: bookingsState } = useTutorBookings();
  const { state: availabilityState } = useTutorAvailability();
  const { state: conversationsState } = useConversations();
  // Statut RÉEL du dossier (serveur, mis à jour en direct) — et non un drapeau local posé à l'envoi.
  const isPendingValidation = useAuthStore((s) => s.user?.tutor?.applicationStatus === "pending");
  // Tuteur restreint : il garde l'accès à son espace, mais avec une alerte (profil masqué, acceptation impossible).
  const isSuspended = useAuthStore((s) => isTutorSuspended(s.user));

  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => toIsoDate(new Date()));

  // Créneaux disponibles + rendez-vous sur ~6 mois : pastilles du calendrier et détail du jour choisi.
  const rawAvailability = availabilityState.status === "success" ? availabilityState.availability : null;
  const rawBookings = bookingsState.status === "success" ? bookingsState.bookings : null;
  const occurrences = useMemo(
    () => AvailabilityService.expandCalendar(rawAvailability ?? [], rawBookings ?? [], 180),
    [rawAvailability, rawBookings],
  );
  const markers = useMemo(() => markersFromOccurrences(occurrences), [occurrences]);
  // Le jour choisi, en deux parties : les créneaux libres (règles dépliées) et les rendez-vous (demandes comprises).
  const dayAvailability = useMemo(() => occurrences.filter((o) => o.date === selectedDateIso && o.kind === "availability"), [occurrences, selectedDateIso]);
  const dayBookings = useMemo(() => (rawBookings ?? []).filter((b) => b.slot.date === selectedDateIso), [rawBookings, selectedDateIso]);
  const shiftDay = (delta: number) =>
    setSelectedDateIso((iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return toIsoDate(addDays(new Date(y, m - 1, d), delta));
    });

  const profile = profileState.status === "success" ? profileState.profile : null;
  const firstName = profile?.firstName ?? "";

  const bookings = useMemo(() => rawBookings ?? [], [rawBookings]);
  const pending = useMemo(() => bookings.filter((b) => b.status === "pending"), [bookings]);
  const confirmed = useMemo(() => bookings.filter((b) => b.status === "confirmed"), [bookings]);
  // Instant figé au montage : « à venir » ne dépend pas de l'horloge à chaque rendu.
  const [openedAt] = useState(() => Date.now());
  const nextLesson = useMemo(
    () => [...confirmed].filter((b) => new Date(b.slot.startAt).getTime() >= openedAt).sort((x, y) => x.slot.startAt.localeCompare(y.slot.startAt))[0] ?? null,
    [confirmed, openedAt],
  );

  // Les élèves suivis : un par bénéficiaire, d'après les cours confirmés, en cours ou terminés (le plus récent d'abord).
  const students = useMemo(() => {
    const unreadBookingIds = new Set(
      (conversationsState.status === "success" ? conversationsState.conversations : []).filter((c) => c.unreadCount > 0 && c.bookingId).map((c) => c.bookingId),
    );
    const seen = new Map<string, { booking: Booking; fresh: boolean }>();
    for (const booking of [...bookings].sort((a, b) => b.slot.startAt.localeCompare(a.slot.startAt))) {
      if (booking.status !== "confirmed" && booking.status !== "in_progress" && booking.status !== "completed") continue;
      const fresh = unreadBookingIds.has(booking.id);
      const known = seen.get(booking.beneficiary.id);
      if (known) known.fresh = known.fresh || fresh;
      else seen.set(booking.beneficiary.id, { booking, fresh });
    }
    return [...seen.values()];
  }, [bookings, conversationsState]);

  const loaded = bookingsState.status === "success" && availabilityState.status === "success";
  const isFreshStart = loaded && pending.length === 0 && confirmed.length === 0 && (rawAvailability?.length ?? 0) === 0;

  const status = isSuspended
    ? { label: t("tutorDashboard.dashboard.statusRestricted"), dot: "bg-error" }
    : isPendingValidation
      ? { label: t("tutorDashboard.dashboard.statusInReview"), dot: "bg-warning" }
      : profile && !profile.isVisible
        ? { label: t("tutorDashboard.dashboard.statusHidden"), dot: "bg-ink-faint" }
        : { label: t("tutorDashboard.dashboard.statusVisible"), dot: "bg-accent" };

  const shareProfile = async () => {
    if (!profile) return;
    const link = Linking.createURL(`/results/tutor/${profile.id}`);
    try {
      await Share.share({ message: t("tutorDashboard.dashboard.shareMessage", { link }) });
    } catch {
      // Partage annulé ou indisponible : rien à signaler.
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <AppHeader onHeight={setHeaderHeight}>
        <Logo size={32} />
        <View className="flex-row items-center gap-[10px]">
          <PressableScale onPress={() => router.push(MODE_SWITCH_ROUTE)} accessibilityLabel={t("tutorDashboard.dashboard.switchModeTutor")}>
            <View className="flex-row items-center gap-[6px] rounded-full bg-primary-tint py-[7px] pl-[10px] pr-3">
              <TeachIcon size={15} color="#332E86" />
              <Text className="text-[13px] font-bold text-primary">{t("common.tutor")}</Text>
              <View style={{ transform: [{ rotate: "90deg" }] }}>
                <ChevronRightIcon size={13} color="#332E86" />
              </View>
            </View>
          </PressableScale>
          <NotificationBell />
        </View>
      </AppHeader>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, paddingTop: headerHeight + 6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profil : visage, salutation et état réel du profil. */}
        <FadeIn delay={30}>
          <View className="mb-5 flex-row items-center gap-3.5 px-5">
            <PressableScale onPress={() => router.push(PROFILE_ROUTE)} accessibilityLabel={t("common.profile")}>
              <TutorAvatar gender={profile?.gender} photoUrl={profile?.photoUrl} name={profile ? `${profile.firstName} ${profile.lastName}` : null} size={56} radius={18} />
            </PressableScale>
            <View className="min-w-0 flex-1">
              <Text className="text-[24px] font-bold font-display text-ink" numberOfLines={1}>{t("common.hello", { value: firstName ? `, ${firstName}` : "" })}</Text>
              <View className="mt-1 flex-row items-center gap-[6px] self-start rounded-full border border-line-soft bg-surface px-[10px] py-[4px]">
                <View className={["h-[8px] w-[8px] rounded-full", status.dot].join(" ")} />
                <Text className="text-[12px] font-semibold text-ink-soft">{status.label}</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        <View className="px-5">
          {isSuspended ? (
            <FadeIn delay={50}>
              <View className="mb-5 rounded-2xl border border-error/30 bg-error-tint p-4" accessibilityRole="alert">
                <View className="mb-2 flex-row items-center gap-[6px]">
                  <AlertTriangleIcon size={16} color="#AC4A40" />
                  <Text className="text-[12px] font-bold text-error">{t("tutorDashboard.dashboard.accountRestricted")}</Text>
                </View>
                <Text className="text-[13px] leading-[18.5px] text-ink-soft">
                  {t("tutorDashboard.dashboard.accountRestrictedBody")}</Text>
              </View>
            </FadeIn>
          ) : null}

          {isPendingValidation ? (
            <FadeIn delay={50}>
              <View className="mb-5 rounded-2xl border border-warning/30 bg-warning-tint p-4">
                <View className="mb-2 flex-row items-center gap-[6px]">
                  <ClockIcon size={16} color="#D4890A" />
                  <Text className="text-[12px] font-bold text-warning">{t("tutorDashboard.dashboard.fileUnderReview")}</Text>
                </View>
                <Text className="text-[13px] leading-[18.5px] text-ink-soft">
                  {t("tutorDashboard.dashboard.yourApplicationIsCurrentlyBeing")}</Text>
              </View>
            </FadeIn>
          ) : null}

          {/* Ce qui m'attend : une invitation à agir au démarrage, puis demandes + prochain cours. */}
          <FadeIn delay={60}>
            {bookingsState.status === "loading" || availabilityState.status === "loading" ? (
              <View className="mb-6 flex-row gap-3">
                <View className="h-[132px] flex-1 rounded-2xl bg-line-soft" />
                <View className="h-[132px] flex-1 rounded-2xl bg-line-soft" />
              </View>
            ) : isFreshStart ? (
              <View className="mb-6 rounded-3xl border border-primary/15 bg-primary-tint p-5">
                <Text className="text-[19px] font-bold font-display text-ink">{t("tutorDashboard.dashboard.readyTitle")}</Text>
                <Text className="mb-4 mt-1.5 text-[13.5px] leading-[19px] text-ink-soft">{t("tutorDashboard.dashboard.readyBody")}</Text>
                <Button label={t("tutorDashboard.dashboard.readyCta")} variant="animated" animatedGlow onPress={() => router.push(newAvailabilityRoute(selectedDateIso))} fullWidth />
              </View>
            ) : (
              <View className="mb-6 flex-row gap-3">
                <RequestsCard
                  pending={pending}
                  onPress={() => router.push(pending.length === 1 ? requestRoute(pending[0].id) : REQUESTS_ROUTE)}
                  onBoost={() => router.push(PROFILE_ROUTE)}
                />
                <NextLessonCard booking={nextLesson} label={nextLesson ? lessonCountdown(nextLesson, t as never) : null} onPress={() => router.push(nextLesson ? appointmentRoute(nextLesson.id) : APPOINTMENTS_ROUTE)} />
              </View>
            )}
          </FadeIn>
        </View>

        {/* Mes élèves : bulles façon stories, ou invitation à partager son profil. */}
        <FadeIn delay={80}>
          <View className="mb-6">
            <Text className="mb-3 px-5 text-[17px] font-bold font-display text-ink">{t("tutorDashboard.dashboard.myStudents")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
              <StoryBubble label={t("tutorDashboard.dashboard.shareProfile")} variant="add" onPress={() => void shareProfile()} />
              {students.map(({ booking, fresh }) => (
                <StoryBubble
                  key={booking.beneficiary.id}
                  label={booking.beneficiary.firstName}
                  accessibilityLabel={t("tutorDashboard.dashboard.openStudent", { name: booking.beneficiary.firstName })}
                  name={`${booking.beneficiary.firstName} ${booking.beneficiary.lastName}`}
                  highlighted={fresh}
                  onPress={() => router.push(appointmentRoute(booking.id))}
                />
              ))}
            </ScrollView>
          </View>
        </FadeIn>

        {/* Planning : calendrier clair, puis les créneaux du jour choisi. */}
        <FadeIn delay={100}>
          <View className="mb-6 px-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[17px] font-bold font-display text-ink">{t("tutorDashboard.dashboard.myCalendarAvailabilities")}</Text>
              <PressableScale onPress={() => router.push(CALENDAR_ROUTE)} accessibilityLabel={t("tutorDashboard.dashboard.openTheFullCalendar")}>
                <Text className="text-[12.5px] font-bold text-primary">{t("tutorDashboard.dashboard.manage")}</Text>
              </PressableScale>
            </View>

            <HabitCalendar
              variant="card"
              selectedDate={selectedDateIso}
              onSelectDate={setSelectedDateIso}
              markers={markers}
              onAdd={() => router.push(newAvailabilityRoute(selectedDateIso))}
            />
            <View className="mt-4">
              {/* Emploi du temps du jour, comme chez le demandeur : créneaux libres en pointillés, rendez-vous par-dessus. */}
              <TutorDayTimetable
                day={selectedDateIso}
                availability={dayAvailability}
                bookings={dayBookings}
                loading={availabilityState.status === "loading" || bookingsState.status === "loading"}
                onShiftDay={shiftDay}
                onOpenAvailability={(id) => router.push(editAvailabilityRoute(id))}
                onOpenBooking={(booking) => router.push(booking.status === "pending" ? requestRoute(booking.id) : appointmentRoute(booking.id))}
                onAdd={() => router.push(newAvailabilityRoute(selectedDateIso))}
              />
            </View>
          </View>
        </FadeIn>

        {/* Demandes : la section n'existe que s'il y en a ; « Tout voir » seulement au-delà de deux. */}
        {pending.length > 0 ? (
          <FadeIn delay={120}>
            <View className="mb-6 px-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[17px] font-bold font-display text-ink">{t("tutorDashboard.dashboard.pendingRequests")}</Text>
                {pending.length > 2 ? (
                  <PressableScale onPress={() => router.push(REQUESTS_ROUTE)} accessibilityLabel={t("tutorDashboard.dashboard.seeAllRequests")}>
                    <Text className="text-[12.5px] font-bold text-primary">{t("tutorDashboard.dashboard.seeAll")}</Text>
                  </PressableScale>
                ) : null}
              </View>
              <PendingRequestCard booking={pending[0]} onPress={() => router.push(requestRoute(pending[0].id))} />
            </View>
          </FadeIn>
        ) : null}

        <FadeIn delay={140}>
          <View className="px-5">
            <Text className="mb-3 text-[17px] font-bold font-display text-ink">{t("tutorDashboard.dashboard.shortcuts")}</Text>
            <View className="flex-row gap-3">
              <ToolTile icon={<SubjectIcon size={22} color="#4F46E5" />} tint="#EEF2FF" label={t("tutorDashboard.offers.myOffers")} onPress={() => router.push(OFFERS_ROUTE)} />
              <ToolTile icon={<HouseIcon size={22} color="#0E9C82" />} tint="#E1F5EF" label={t("common.partnerRooms")} onPress={() => router.push(ROOMS_ROUTE)} />
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      <TutorBottomNav active="home" />
    </View>
  );
}

/** Demandes en attente : pastille ambre quand il y en a (avec le prénom de la première), sinon « Booster mon profil ». */
function RequestsCard({ pending, onPress, onBoost }: { pending: Booking[]; onPress: () => void; onBoost: () => void }) {
  const { t } = useTranslation();
  if (pending.length === 0) {
    return (
      <View className="min-h-[132px] flex-1 justify-between rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
        <Text className="text-[14px] font-bold text-ink-soft">{t("tutorDashboard.dashboard.noRequestsTitle")}</Text>
        <PressableScale onPress={onBoost} accessibilityLabel={t("tutorDashboard.dashboard.boostProfile")}>
          <View className="items-center rounded-full bg-primary-tint px-3 py-[9px]">
            <Text className="text-[12.5px] font-bold text-primary">{t("tutorDashboard.dashboard.boostProfile")}</Text>
          </View>
        </PressableScale>
      </View>
    );
  }
  const first = pending[0];
  return (
    <View className="flex-1">
      <PressableScale onPress={onPress} accessibilityLabel={t("tutorDashboard.dashboard.viewAllReceivedRequests")}>
        <View className="min-h-[132px] justify-between rounded-2xl border border-warning/40 bg-warning-tint p-4">
          <View className="flex-row items-start justify-between">
            <Text className="text-[30px] font-bold font-display leading-[34px] text-ink">{pending.length}</Text>
            <TutorAvatar name={`${first.beneficiary.firstName} ${first.beneficiary.lastName}`} size={34} />
          </View>
          <View>
            <Text className="text-[13px] font-bold text-[#9A5F06]" numberOfLines={2}>
              {t("tutorDashboard.dashboard.requestsWaiting", { count: pending.length })}
            </Text>
            <Text className="mt-[1px] text-[12px] text-ink-soft" numberOfLines={1}>
              {first.beneficiary.firstName} • {first.slot.startTime}
            </Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

/** Prochain cours confirmé, avec son compte à rebours (« Demain à 14:00 »). */
function NextLessonCard({ booking, label, onPress }: { booking: Booking | null; label: string | null; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <PressableScale onPress={onPress} accessibilityLabel={t("tutorDashboard.dashboard.nextLesson")}>
        <View className="min-h-[132px] justify-between rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
          <Text className="text-[12.5px] font-semibold text-ink-soft">{t("tutorDashboard.dashboard.nextLesson")}</Text>
          {booking && label ? (
            <View>
              <Text className="text-[17px] font-bold font-display leading-[22px] text-ink" numberOfLines={2}>{label}</Text>
              <View className="mt-2 flex-row items-center gap-2">
                <TutorAvatar name={`${booking.beneficiary.firstName} ${booking.beneficiary.lastName}`} size={24} />
                <Text className="flex-1 text-[12.5px] text-ink-soft" numberOfLines={1}>
                  {t("common.with", { tutorName: booking.beneficiary.firstName })}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="text-[14px] font-semibold text-ink-faint">{t("tutorDashboard.dashboard.noNextLesson")}</Text>
          )}
        </View>
      </PressableScale>
    </View>
  );
}

function ToolTile({ icon, tint, label, onPress }: { icon: ReactNode; tint: string; label: string; onPress: () => void }) {
  return (
    <View className="flex-1">
      <PressableScale onPress={onPress} accessibilityLabel={label}>
        <View className="flex-row items-center gap-3 rounded-2xl border border-line-soft bg-surface p-3.5 shadow-card">
          <View className="h-[40px] w-[40px] items-center justify-center rounded-xl" style={{ backgroundColor: tint }}>
            {icon}
          </View>
          <Text className="flex-1 text-[13.5px] font-bold text-ink" numberOfLines={2}>{label}</Text>
        </View>
      </PressableScale>
    </View>
  );
}

function PendingRequestCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
      <View className="mb-1 flex-row items-start justify-between">
        <View className="flex-row items-center gap-3">
          <TutorAvatar name={`${booking.beneficiary.firstName} ${booking.beneficiary.lastName}`} size={40} />
          <View>
            <Text className="text-[15px] font-bold text-ink">{booking.beneficiary.firstName}</Text>
            <Text className="mt-[2px] text-[13px] text-ink-soft">{booking.offer.title.split(" ")[0]}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-[6px] self-start rounded-full border border-warning bg-surface px-[11px] py-[5px]">
          <View className="h-[7px] w-[7px] rounded-full bg-[#F59E0B]" />
          <Text className="text-[12px] font-bold text-[#9A5F06]">{t("common.pending")}</Text>
        </View>
      </View>
      <Text className="mb-[14px] mt-2 text-[12.5px] text-ink-soft">
        {booking.slot.dateLabel} • {booking.slot.startTime}
      </Text>
      {/* Both actions open the full request detail (53) before anything is
          confirmed/refused, matching the mock's own hrefs and giving the
          tutor full context before an impactful decision. */}
      <View className="flex-row gap-[10px]">
        <PressableScale onPress={onPress} accessibilityLabel={t("tutorDashboard.dashboard.viewSRequest", { firstName: booking.beneficiary.firstName })} style={{ flex: 1 }}>
          <View className="items-center justify-center rounded-full border border-line px-4 py-[10px]">
            <Text className="text-[13px] font-semibold text-ink">{t("common.decline")}</Text>
          </View>
        </PressableScale>
        <PressableScale onPress={onPress} accessibilityLabel={t("tutorDashboard.dashboard.viewSRequest", { firstName: booking.beneficiary.firstName })} style={{ flex: 1 }}>
          <View className="items-center justify-center rounded-full bg-primary px-4 py-[10px]">
            <Text className="text-[13px] font-semibold text-white">{t("common.accept")}</Text>
          </View>
        </PressableScale>
      </View>
    </View>
  );
}
