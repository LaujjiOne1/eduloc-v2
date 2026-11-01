import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Defs, Line, Pattern, Rect, Svg } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { CalendarIcon, CheckIcon, ChevronRightIcon, ClockIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { addDays, toIsoDate } from "@/lib/week";
import type { Booking } from "@/types/booking";
import { formatDayLabel } from "@/utils/calendar";

export const HOUR_HEIGHT = 64;
export const GUTTER = 46;
const MIN_BLOCK = 58;
/** Plage affichée par défaut ; elle s'élargit si un cours sort de ces bornes. */
export const DEFAULT_FROM = 8;
export const DEFAULT_TO = 18;

export const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
export const localDay = (iso: string) => toIsoDate(new Date(iso));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Heure courante, rafraîchie régulièrement : le fond des cours confirmés avance et la ligne « maintenant » se déplace. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Avancement du « chargement » d'un cours confirmé : de la création de la demande jusqu'à l'heure du cours (0 → 1). */
function progressOf(booking: Booking, now: number): number {
  const from = new Date(booking.createdAt).getTime();
  const to = new Date(booking.slot.startAt).getTime();
  if (to <= from) return 1;
  return clamp01((now - from) / (to - from));
}

type Lane = { booking: Booking; top: number; height: number; column: number; columns: number };

export type Placed<T> = { data: T; top: number; height: number; column: number; columns: number };

/** Place des blocs d'une journée (début et fin en minutes) ; deux blocs qui se chevauchent se partagent la largeur. */
export function layoutIntervals<T>(entries: { data: T; start: number; end: number }[], fromMinute: number): Placed<T>[] {
  const sorted = [...entries].sort((x, y) => x.start - y.start);
  const placed: Placed<T>[] = [];
  let group: (Placed<T> & { end: number })[] = [];
  let groupEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...group.map((l) => l.column + 1));
    group.forEach((l) => (l.columns = columns));
    placed.push(...group);
    group = [];
  };
  for (const entry of sorted) {
    const start = entry.start;
    const end = Math.max(start + 30, entry.end);
    if (group.length > 0 && start >= groupEnd) flush();
    const taken = new Set(group.filter((l) => l.end > start).map((l) => l.column));
    let column = 0;
    while (taken.has(column)) column += 1;
    group.push({
      data: entry.data,
      end,
      top: ((start - fromMinute) / 60) * HOUR_HEIGHT,
      height: Math.max(MIN_BLOCK, ((end - start) / 60) * HOUR_HEIGHT - 4),
      column,
      columns: 1,
    });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return placed;
}

/** Place les cours d'une journée. */
function layoutDay(bookings: Booking[], fromMinute: number): Lane[] {
  return layoutIntervals(
    bookings.map((booking) => ({ data: booking, start: minutesOf(booking.slot.startAt), end: minutesOf(booking.slot.endAt) })),
    fromMinute,
  ).map((p) => ({ booking: p.data, top: p.top, height: p.height, column: p.column, columns: p.columns }));
}

type TimetableGridProps = {
  /** Première et dernière heure affichées. */
  from: number;
  to: number;
  nowMinutes: number;
  showNowLine: boolean;
  /** Posé sous les blocs (ex. les créneaux libres du tuteur, qui servent de fond aux rendez-vous). */
  behind?: ReactNode;
  children: ReactNode;
};

/** La grille d'une journée : heures en colonne, zone où se posent les blocs, et la ligne « maintenant ». */
export function TimetableGrid({ from, to, nowMinutes, showNowLine, behind, children }: TimetableGridProps) {
  const { t } = useTranslation();
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const gridHeight = (to - from) * HOUR_HEIGHT;
  return (
    <View className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
      <View style={{ height: gridHeight + 24, paddingTop: 12 }}>
        {/* Lignes d'heures */}
        {hours.map((hour) => (
          <View key={hour} style={{ position: "absolute", left: 0, right: 0, top: 12 + (hour - from) * HOUR_HEIGHT }}>
            <View className="flex-row items-center">
              <Text style={{ width: GUTTER }} className="pl-3 text-[11px] font-semibold text-ink-faint">
                {String(hour).padStart(2, "0")}:00
              </Text>
              <View className="h-px flex-1 bg-line-soft" />
            </View>
          </View>
        ))}

        {/* Blocs */}
        <View style={{ position: "absolute", left: GUTTER + 6, right: 10, top: 12, height: gridHeight }}>
          {behind}
          {children}
        </View>

        {/* Maintenant */}
        {showNowLine ? (
          <View
            pointerEvents="none"
            accessibilityLabel={t("apprentiDashboard.timetable.nowLine")}
            style={{ position: "absolute", left: GUTTER - 4, right: 0, top: 12 + ((nowMinutes - from * 60) / 60) * HOUR_HEIGHT - 4, flexDirection: "row", alignItems: "center" }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E04F5F" }} />
            <View style={{ height: 1.5, flex: 1, backgroundColor: "#E04F5F" }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

type DayTimetableProps = {
  bookings: Booking[];
  onOpenBooking: (bookingId: string) => void;
};

/**
 * Emploi du temps d'une journée, comme un calendrier : les heures en colonne, chaque cours posé à sa place. Un cours pas encore
 * accepté est hachuré et en pointillés (« pas encore disponible ») ; une fois confirmé il devient plein et son fond se remplit
 * peu à peu à l'approche de l'heure du cours.
 */
export function DayTimetable({ bookings, onOpenBooking }: DayTimetableProps) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const todayIso = toIsoDate(new Date(now));

  const active = useMemo(() => bookings.filter((b) => b.status !== "cancelled" && b.status !== "refused"), [bookings]);
  // Jour affiché : aujourd'hui s'il y a un cours, sinon le jour du prochain cours, sinon aujourd'hui.
  const initialDay = useMemo(() => {
    if (active.some((b) => localDay(b.slot.startAt) === todayIso)) return todayIso;
    const next = [...active].filter((b) => new Date(b.slot.endAt).getTime() >= now).sort((a, b) => a.slot.startAt.localeCompare(b.slot.startAt))[0];
    return next ? localDay(next.slot.startAt) : todayIso;
    // Calculé une fois : l'utilisateur garde ensuite la main sur le jour affiché.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? initialDay;

  const dayBookings = useMemo(() => active.filter((b) => localDay(b.slot.startAt) === day), [active, day]);
  const shift = (delta: number) => {
    const [y, m, d] = day.split("-").map(Number);
    setPicked(toIsoDate(addDays(new Date(y, m - 1, d), delta)));
  };

  const fromHour = Math.min(DEFAULT_FROM, ...dayBookings.map((b) => Math.floor(minutesOf(b.slot.startAt) / 60) - 1));
  const toHour = Math.max(DEFAULT_TO, ...dayBookings.map((b) => Math.ceil(minutesOf(b.slot.endAt) / 60) + 1));
  const from = Math.max(0, fromHour);
  const to = Math.min(24, toHour);
  const lanes = useMemo(() => layoutDay(dayBookings, from * 60), [dayBookings, from]);

  const nowMinutes = minutesOf(new Date(now).toISOString());
  const showNowLine = day === todayIso && nowMinutes >= from * 60 && nowMinutes <= to * 60;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text className="text-[17px] font-bold font-display uppercase tracking-[0.5px] text-ink">{t("apprentiDashboard.timetable.title")}</Text>
          <Text className="text-[12.5px] text-ink-soft" numberOfLines={1}>
            {day === todayIso ? `${t("apprentiDashboard.timetable.today")} • ` : ""}
            {formatDayLabel(day)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <DayArrow direction="prev" label={t("apprentiDashboard.timetable.previousDay")} onPress={() => shift(-1)} />
          <DayArrow direction="next" label={t("apprentiDashboard.timetable.nextDay")} onPress={() => shift(1)} />
        </View>
      </View>

      {dayBookings.length === 0 ? (
        <View className="items-center rounded-2xl border border-dashed border-line bg-surface px-5 py-7">
          <CalendarIcon size={22} color="#9799AF" />
          <Text className="mt-2 text-[14.5px] font-bold text-ink">{t("apprentiDashboard.timetable.noLessons")}</Text>
          <Text className="mt-1 max-w-[260px] text-center text-[12.5px] leading-[18px] text-ink-soft">{t("apprentiDashboard.timetable.noLessonsHint")}</Text>
        </View>
      ) : (
        <TimetableGrid from={from} to={to} nowMinutes={nowMinutes} showNowLine={showNowLine}>
          {lanes.map((lane) => (
            <LessonBlock key={lane.booking.id} lane={lane} now={now} viewer="learner" onPress={() => onOpenBooking(lane.booking.id)} />
          ))}
        </TimetableGrid>
      )}
    </View>
  );
}

export function DayArrow({ direction, label, onPress }: { direction: "prev" | "next"; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View className="h-9 w-9 items-center justify-center rounded-full border border-line-soft bg-surface">
        <View style={{ transform: [{ rotate: direction === "prev" ? "180deg" : "0deg" }] }}>
          <ChevronRightIcon size={15} color="#332E86" />
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Un cours dans la grille : hachuré tant qu'il n'est pas accepté, plein et « qui se charge » une fois confirmé.
 * `viewer` : le demandeur y voit son tuteur, le tuteur y voit l'élève (et c'est à lui d'accepter une demande en attente).
 */
export function LessonBlock({ lane, now, onPress, viewer }: { lane: Lane; now: number; onPress: () => void; viewer: "learner" | "tutor" }) {
  const { t } = useTranslation();
  const { booking } = lane;
  const pending = booking.status === "pending";
  const inProgress = booking.status === "in_progress";
  const completed = booking.status === "completed";
  const confirmed = booking.status === "confirmed";

  const progress = pending ? 0 : inProgress || completed ? 1 : progressOf(booking, now);
  const fill = useSharedValue(progress);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: 700 }));
  }, [progress, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  // Une demande qui vient d'être acceptée (le statut change en direct) : un éclat vert, puis le bloc se « remplit ».
  const flash = useSharedValue(0);
  const previous = useRef(booking.status);
  useEffect(() => {
    if (previous.current === "pending" && booking.status === "confirmed") {
      flash.set(withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 900 })));
    }
    previous.current = booking.status;
  }, [booking.status, flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() * 0.55 }));

  // Point qui pulse pour « en cours ».
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (inProgress) pulse.set(withRepeat(withTiming(1, { duration: 800 }), -1, true));
  }, [inProgress, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 1 - pulse.get() * 0.7 }));

  const minutesLeft = Math.max(0, Math.round((new Date(booking.slot.startAt).getTime() - now) / 60_000));
  const countdown =
    minutesLeft < 60
      ? t("apprentiDashboard.timetable.startsInMinutes", { count: Math.max(1, minutesLeft) })
      : minutesLeft < 24 * 60
        ? t("apprentiDashboard.timetable.startsInHours", { hours: Math.floor(minutesLeft / 60), minutes: String(minutesLeft % 60).padStart(2, "0") })
        : t("apprentiDashboard.timetable.startsInDays", { count: Math.floor(minutesLeft / (24 * 60)) });

  const width = 100 / lane.columns;
  const accent = inProgress ? "#6F63DA" : "#0E9C82";
  // L'autre personne : le tuteur pour le demandeur, l'élève (bénéficiaire) pour le tuteur.
  const otherName = viewer === "learner" ? booking.offer.tutorName : `${booking.beneficiary.firstName} ${booking.beneficiary.lastName}`.trim();
  const tutorFirst = otherName.split(" ")[0] ?? otherName;

  return (
    <View style={{ position: "absolute", top: lane.top, height: lane.height, left: `${lane.column * width}%`, width: `${width}%`, paddingRight: lane.columns > 1 ? 4 : 0 }}>
      <PressableScale onPress={onPress} accessibilityLabel={`${booking.offer.subjectLabel} ${booking.slot.startTime}`}>
        <View
          style={{
            height: lane.height,
            borderRadius: 14,
            overflow: "hidden",
            borderWidth: pending ? 1.5 : 1,
            borderStyle: pending ? "dashed" : "solid",
            borderColor: pending ? "#D4890A" : completed ? "#E2E8F0" : accent,
            backgroundColor: pending ? "#FFFBF2" : "#FFFFFF",
            opacity: completed ? 0.75 : 1,
          }}
        >
          {/* Pas encore disponible : hachures ambre discrètes. */}
          {pending ? (
            <Svg width="100%" height="100%" style={{ position: "absolute" }} pointerEvents="none">
              <Defs>
                <Pattern id={`hatch-${booking.id}`} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                  <Line x1="0" y1="0" x2="0" y2="10" stroke="#D4890A" strokeOpacity="0.16" strokeWidth="3" />
                </Pattern>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#hatch-${booking.id})`} />
            </Svg>
          ) : (
            // Confirmé : le fond se remplit, de la demande jusqu'à l'heure du cours.
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: inProgress ? "rgba(111,99,218,0.20)" : "rgba(14,156,130,0.18)", borderRightWidth: progress < 1 ? 2 : 0, borderRightColor: accent }, fillStyle]}
            />
          )}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#0E9C82" }, flashStyle]} />

          <View className="flex-1 justify-center px-3 py-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="shrink text-[12px] font-bold text-ink-soft">
                {booking.slot.startTime} – {booking.slot.endTime}
              </Text>
              {pending ? (
                <View className="flex-row items-center gap-1 rounded-full bg-warning-tint px-2 py-[2px]">
                  <ClockIcon size={11} color="#D4890A" />
                  <Text className="text-[10.5px] font-bold text-[#9A5F06]">{t("apprentiDashboard.timetable.pending")}</Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1 rounded-full px-2 py-[2px]" style={{ backgroundColor: inProgress ? "#ECEAF9" : "#E1F5EF" }}>
                  {inProgress ? <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }, pulseStyle]} /> : <CheckIcon size={10} color={accent} />}
                  <Text className="text-[10.5px] font-bold" style={{ color: accent }}>
                    {inProgress ? t("apprentiDashboard.timetable.inProgress") : completed ? t("apprentiDashboard.timetable.completed") : t("apprentiDashboard.timetable.confirmed")}
                  </Text>
                </View>
              )}
            </View>
            <Text className="mt-0.5 text-[14.5px] font-bold text-ink" numberOfLines={1}>
              {booking.offer.subjectLabel}
            </Text>
            {lane.height > 74 ? (
              <Text className="mt-0.5 text-[12px] text-ink-soft" numberOfLines={2}>
                {pending
                  ? viewer === "learner"
                    ? t("apprentiDashboard.timetable.pendingHint", { name: tutorFirst })
                    : t("tutorDashboard.timetable.pendingHint", { name: tutorFirst })
                  : confirmed
                    ? `${t("common.with", { tutorName: otherName })} • ${countdown}`
                    : t("common.with", { tutorName: otherName })}
              </Text>
            ) : (
              <Text className="text-[11.5px] text-ink-soft" numberOfLines={1}>
                {pending ? tutorFirst : confirmed ? countdown : otherName}
              </Text>
            )}
          </View>
        </View>
      </PressableScale>
    </View>
  );
}
