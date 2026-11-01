import { useMemo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CalendarIcon, CheckIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_FROM,
  DEFAULT_TO,
  DayArrow,
  HOUR_HEIGHT,
  LessonBlock,
  TimetableGrid,
  layoutIntervals,
  minutesOf,
  useNow,
} from "@/components/ui/day-timetable";
import { toIsoDate } from "@/lib/week";
import type { CalendarOccurrence } from "@/types/availability";
import type { Booking } from "@/types/booking";
import { formatDayLabel } from "@/utils/calendar";

/** « 14:30 » → minutes depuis minuit. */
const minutesOfClock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

type TutorDayTimetableProps = {
  /** Jour affiché (AAAA-MM-JJ) : c'est le calendrier de l'accueil qui le choisit. */
  day: string;
  /** Créneaux LIBRES du jour (règles de disponibilité dépliées). */
  availability: CalendarOccurrence[];
  /** Rendez-vous du jour : demandes en attente, confirmés, en cours, terminés. */
  bookings: Booking[];
  loading: boolean;
  onShiftDay: (delta: number) => void;
  onOpenAvailability: (availabilityId: string) => void;
  onOpenBooking: (booking: Booking) => void;
  onAdd: () => void;
};

/**
 * Emploi du temps d'une journée du tuteur, dans le même style que celui du demandeur : les heures en colonne, chaque bloc posé
 * à sa place. Les créneaux LIBRES sont des bandes émeraude en pointillés (« Disponible ») ; les rendez-vous se posent par-dessus :
 * hachurés tant que la demande n'est pas acceptée, pleins et « qui se chargent » une fois confirmés.
 */
export function TutorDayTimetable({ day, availability, bookings, loading, onShiftDay, onOpenAvailability, onOpenBooking, onAdd }: TutorDayTimetableProps) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const todayIso = toIsoDate(new Date(now));

  const visibleBookings = useMemo(() => bookings.filter((b) => b.status !== "cancelled" && b.status !== "refused"), [bookings]);
  const slots = useMemo(() => [...availability].sort((a, b) => a.startTime.localeCompare(b.startTime)), [availability]);

  // Plage affichée : 8 h – 18 h par défaut, élargie si un créneau ou un rendez-vous en sort.
  const starts = [...slots.map((s) => Math.floor(minutesOfClock(s.startTime) / 60) - 1), ...visibleBookings.map((b) => Math.floor(minutesOf(b.slot.startAt) / 60) - 1)];
  const ends = [...slots.map((s) => Math.ceil(minutesOfClock(s.endTime) / 60) + 1), ...visibleBookings.map((b) => Math.ceil(minutesOf(b.slot.endAt) / 60) + 1)];
  const from = Math.max(0, Math.min(DEFAULT_FROM, ...starts));
  const to = Math.min(24, Math.max(DEFAULT_TO, ...ends));

  const lanes = useMemo(
    () =>
      layoutIntervals(
        visibleBookings.map((booking) => ({ data: booking, start: minutesOf(booking.slot.startAt), end: minutesOf(booking.slot.endAt) })),
        from * 60,
      ),
    [visibleBookings, from],
  );

  const nowMinutes = minutesOf(new Date(now).toISOString());
  const showNowLine = day === todayIso && nowMinutes >= from * 60 && nowMinutes <= to * 60;
  const empty = !loading && slots.length === 0 && visibleBookings.length === 0;

  const freeBands = slots.map((slot) => {
    const start = minutesOfClock(slot.startTime);
    const end = Math.max(start + 30, minutesOfClock(slot.endTime));
    return { slot, top: ((start - from * 60) / 60) * HOUR_HEIGHT, height: ((end - start) / 60) * HOUR_HEIGHT - 4 };
  });

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
          <DayArrow direction="prev" label={t("apprentiDashboard.timetable.previousDay")} onPress={() => onShiftDay(-1)} />
          <DayArrow direction="next" label={t("apprentiDashboard.timetable.nextDay")} onPress={() => onShiftDay(1)} />
        </View>
      </View>

      {loading ? (
        <View className="h-[160px] rounded-2xl bg-line-soft" />
      ) : empty ? (
        <View className="items-center rounded-2xl border border-dashed border-line bg-surface px-5 py-7">
          <CalendarIcon size={22} color="#9799AF" />
          <Text className="mt-2 text-[14.5px] font-bold text-ink">{t("ui.dayAgenda.noSlotsOnThisDay")}</Text>
          <Text className="mb-3 mt-1 max-w-[260px] text-center text-[12.5px] leading-[18px] text-ink-soft">{t("ui.dayAgenda.youHaveNoAvailabilityOr")}</Text>
          <Button label={t("ui.dayAgenda.addASlotOnThis")} size="sm" onPress={onAdd} />
        </View>
      ) : (
        <>
          <TimetableGrid
            from={from}
            to={to}
            nowMinutes={nowMinutes}
            showNowLine={showNowLine}
            behind={freeBands.map(({ slot, top, height }) => (
              <FreeBand key={`${slot.availabilityId}-${slot.startTime}`} slot={slot} top={top} height={height} onPress={() => slot.availabilityId && onOpenAvailability(slot.availabilityId)} />
            ))}
          >
            {lanes.map((lane) => (
              <LessonBlock
                key={lane.data.id}
                lane={{ booking: lane.data, top: lane.top, height: lane.height, column: lane.column, columns: lane.columns }}
                now={now}
                viewer="tutor"
                onPress={() => onOpenBooking(lane.data)}
              />
            ))}
          </TimetableGrid>
          <View className="mt-3 items-center">
            <Button label={t("ui.dayAgenda.addASlotOnThis")} variant="ghost" size="sm" onPress={onAdd} />
          </View>
        </>
      )}
    </View>
  );
}

/** Un créneau libre : bande émeraude en pointillés posée derrière les rendez-vous ; un toucher ouvre sa modification. */
function FreeBand({ slot, top, height, onPress }: { slot: CalendarOccurrence; top: number; height: number; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ position: "absolute", top, height, left: 0, right: 0 }}>
      <PressableScale onPress={onPress} accessibilityLabel={t("ui.dayAgenda.editTheAvailabilityFrom", { startTime: slot.startTime })}>
        <View
          style={{
            height,
            borderRadius: 14,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: "#0E9C82",
            backgroundColor: "rgba(14,156,130,0.07)",
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="shrink text-[12px] font-bold text-ink-soft">{slot.timeRangeLabel}</Text>
            <View className="flex-row items-center gap-1 rounded-full bg-accent-tint px-2 py-[2px]">
              <CheckIcon size={10} color="#0E9C82" />
              <Text className="text-[10.5px] font-bold text-accent">{t("ui.dayAgenda.available")}</Text>
            </View>
          </View>
          <Text className="mt-0.5 text-[14.5px] font-bold text-ink" numberOfLines={1}>
            {slot.label || t("ui.dayAgenda.availableSlot")}
          </Text>
          {height > 74 ? (
            <Text className="mt-0.5 text-[12px] text-ink-soft" numberOfLines={1}>
              {slot.recurring ? t("ui.dayAgenda.everyWeek") : t("ui.dayAgenda.oneTimeOnly")}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    </View>
  );
}
