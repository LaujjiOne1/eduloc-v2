import { Text, View } from "react-native";

import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";
import type { DayMarkers } from "@/components/ui/habit-calendar";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CalendarOccurrence } from "@/types/availability";
import { useTranslation } from "react-i18next";

/** Pastilles du calendrier : un jour a des créneaux disponibles et/ou des rendez-vous. */
export function markersFromOccurrences(occurrences: CalendarOccurrence[]): Record<string, DayMarkers> {
  const markers: Record<string, DayMarkers> = {};
  for (const occurrence of occurrences) {
    const mark = (markers[occurrence.date] ??= {});
    if (occurrence.kind === "booking") mark.booking = true;
    else mark.availability = true;
  }
  return markers;
}

type DayAgendaProps = {
  /** « Jeudi 15 octobre » */
  dateLabel: string;
  items: CalendarOccurrence[];
  onEditAvailability: (availabilityId: string) => void;
  onAdd?: () => void;
  loading?: boolean;
};

/** Détail du jour sélectionné sous le calendrier : créneaux disponibles et rendez-vous, ou état vide avec « Ajouter ». */
export function DayAgenda({ dateLabel, items, onEditAvailability, onAdd, loading }: DayAgendaProps) {
  const { t } = useTranslation();
  return (
    <View>
      <View className="mb-2.5 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[16px] font-bold text-ink">{dateLabel}</Text>
          <Text className="text-[12px] text-ink-soft">
            {loading ? t("common.loading") : items.length === 0 ? t("ui.dayAgenda.nothingPlanned") : t("ui.dayAgenda.slotOrLessonCount", { count: items.length })}
          </Text>
        </View>
        {onAdd ? (
          <PressableScale onPress={onAdd} accessibilityLabel={t("ui.dayAgenda.addASlotOn", { dateLabel })}>
            <View className="flex-row items-center gap-1 rounded-full border border-primary bg-primary-tint/30 px-3 py-1.5">
              <PlusIcon size={13} color="#332E86" />
              <Text className="text-[12px] font-bold text-primary">{t("ui.dayAgenda.slot")}</Text>
            </View>
          </PressableScale>
        ) : null}
      </View>

      {loading ? (
        <View className="h-[88px] rounded-2xl bg-line-soft" />
      ) : items.length === 0 ? (
        <View className="items-center rounded-2xl border border-line bg-surface shadow-card p-5">
          <Text className="text-[14.5px] font-bold text-ink">{t("ui.dayAgenda.noSlotsOnThisDay")}</Text>
          <Text className="mt-1 max-w-[280px] text-center text-[13px] text-ink-soft">
            {t("ui.dayAgenda.youHaveNoAvailabilityOr")}</Text>
          {onAdd ? (
            <View className="mt-3.5">
              <Button label={t("ui.dayAgenda.addASlotOnThis")} size="sm" onPress={onAdd} />
            </View>
          ) : null}
        </View>
      ) : (
        <View className="gap-2.5">
          {items.map((item, index) => (
            <AgendaRow key={`${item.kind}-${item.availabilityId ?? item.bookingId}-${item.startTime}-${index}`} item={item} onEditAvailability={onEditAvailability} />
          ))}
        </View>
      )}
    </View>
  );
}

function AgendaRow({ item, onEditAvailability }: { item: CalendarOccurrence; onEditAvailability: (id: string) => void }) {
  const { t } = useTranslation();
  if (item.kind === "booking") {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border border-line-soft bg-surface p-3.5 shadow-card">
        <View className="rounded-xl bg-accent-tint px-3 py-2">
          <Text className="text-[13px] font-bold text-accent">
            {item.startTime} – {item.endTime}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>
            {item.label}
          </Text>
          <Text className="text-[12px] text-ink-faint">{t("common.confirmedAppointment")}</Text>
        </View>
        <StatusBadge status="confirmed" />
      </View>
    );
  }

  return (
    <PressableScale
      onPress={() => item.availabilityId && onEditAvailability(item.availabilityId)}
      accessibilityLabel={t("ui.dayAgenda.editTheAvailabilityFrom", { startTime: item.startTime })}
    >
      <View className="flex-row items-center gap-3 rounded-2xl border border-line-soft bg-surface p-3.5 shadow-card">
        {/* Plage horaire en badge lavande ; format et lieu en étiquette discrète. */}
        <View className="rounded-xl bg-primary-tint px-3 py-2">
          <Text className="text-[13px] font-bold text-primary">
            {item.startTime} – {item.endTime}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-semibold text-ink" numberOfLines={1}>
            {t("ui.dayAgenda.availableSlot")}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
            <View className="rounded-full bg-paper-alt px-2 py-[2px]">
              <Text className="text-[11px] font-semibold text-ink-soft" numberOfLines={1}>
                {item.label || t("ui.dayAgenda.available")}
              </Text>
            </View>
            <View className={["rounded-full px-2 py-[2px]", item.recurring ? "bg-primary-tint" : "bg-warning-tint"].join(" ")}>
              <Text className={["text-[11px] font-semibold", item.recurring ? "text-primary" : "text-warning"].join(" ")}>
                {item.recurring ? t("ui.dayAgenda.everyWeek") : t("ui.dayAgenda.oneTimeOnly")}
              </Text>
            </View>
          </View>
        </View>
        <ChevronRightIcon size={16} color="#9799AF" />
      </View>
    </PressableScale>
  );
}
