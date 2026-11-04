import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckIcon, ClockIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/ui/empty-state";
import { PressableScale } from "@/components/motion/pressable-scale";
import { AuthHeader } from "@/components/ui/auth-header";
import { Button } from "@/components/ui/button";
import { type DayMarkers, HabitCalendar } from "@/components/ui/habit-calendar";
import { useOfferSlots } from "@/hooks/use-offer-slots";
import { useBookingOptions } from "@/hooks/use-booking-options";
import { useDevicePosition } from "@/hooks/use-device-position";
import { useRoomDaySlots } from "@/hooks/use-room-day-slots";
import { BookingStepCard } from "@/components/booking/booking-step-card";
import { DurationPicker } from "@/components/booking/duration-picker";
import { RoomPicker } from "@/components/booking/room-picker";
import { Chip } from "@/components/ui/chip";
import { TeachingModePicker } from "@/components/booking/teaching-mode-picker";
import { TEACHING_MODE_LABELS, offerTeachingModes, slotTeachingMode } from "@/lib/teaching-mode";
import { toIsoDate } from "@/lib/week";
import { useAuthStore } from "@/store/auth.store";
import { useBookingWizardStore } from "@/store/booking-wizard.store";
import type { TeachingModeId } from "@/types/booking";
import type { BookingDuration } from "@/types/room";
import type { OfferSlot } from "@/types/offer";
import { formatDayLabel } from "@/utils/calendar";
import { useTranslation } from "react-i18next";

// Existing routes — Login already exists (src/app/login.tsx); Beneficiary is
// built by this same task (src/app/beneficiary.tsx).
const LOGIN_ROUTE = "/login" as Href;
const BENEFICIARY_ROUTE = "/beneficiary" as Href;

/** 1 = mode de cours, 2 = durée, 3 = date et créneau. */
type BookingStep = 1 | 2 | 3;

/**
 * Choix du rendez-vous, en trois cartes dépliées une à une (comme la recherche Airbnb) : 1) le mode de cours
 * (en ligne, ou présentiel : chez moi / chez le tuteur / salle partenaire), 2) la durée, 3) la date puis le
 * créneau (le calendrier montre les jours avec des créneaux). La durée précède les horaires (RM-DUR-006) : le
 * serveur ne calcule les créneaux que pour une durée donnée. C'est le SEUL écran de choix de créneau du parcours
 * de réservation (la fiche de l'offre n'en propose plus).
 */
export function BookDateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offer = useBookingWizardStore((s) => s.offer);
  const preselectedSlot = useBookingWizardStore((s) => s.slot);
  const preselectedChoice = useBookingWizardStore((s) => s.choice);
  const setBooking = useBookingWizardStore((s) => s.setBooking);

  const position = useDevicePosition();
  const near = position.state.status === "ready" ? position.state : null;
  const { state: optionsState, retry: retryOptions } = useBookingOptions(offer?.id ?? null, near);
  const options = optionsState.status === "ready" ? optionsState.options : null;
  const minNoticeHours = options?.minNoticeHours ?? 12;
  const places = useMemo(() => offer?.places ?? [], [offer]);

  // Où se déroule le cours : le choix filtre les créneaux. Jamais retenu d'office : le demandeur le choisit toujours
  // en premier (seul un créneau déjà retenu, au retour sur l'écran, le préremplit).
  const [mode, setMode] = useState<TeachingModeId | null>(
    preselectedSlot ? slotTeachingMode(preselectedSlot, places) : null,
  );

  // Durées proposées pour ce mode, déduites des plages du tuteur (de 1 h à la plage, par pas de 30 min) par le backend.
  const durationsFor = (m: TeachingModeId | null): BookingDuration[] =>
    (m && options?.durationsByMode[m]) || options?.durations || [];
  const durations = durationsFor(mode);
  // Durée choisie par le demandeur ; null tant qu'il n'a rien choisi.
  const [durationMinutes, setDurationMinutes] = useState<number | null>(preselectedChoice.durationMinutes);
  // Une seule durée possible : elle s'applique d'office (c'est la longueur de la plage). Sinon, durée de l'offre en attendant.
  const effectiveDuration = durationMinutes ?? (durations.length === 1 ? durations[0].minutes : null) ?? offer?.durationMinutes ?? null;
  const hasDurationStep = durations.length > 1;
  const durationDone = !hasDurationStep || durationMinutes !== null;
  const { slots, loading, error, ensureRange, retry } = useOfferSlots(offer, effectiveDuration);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  // « Salle partenaire » vient du serveur (salles ACCEPTÉES par le tuteur et réservables), pas des lieux du tuteur.
  const availableModes = useMemo(() => {
    const base = offerTeachingModes(places).filter((m) => m !== "partner_room");
    return options?.modes.includes("partner_room") ? [...base, "partner_room" as const] : base;
  }, [places, options]);

  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(preselectedSlot?.id ?? null);
  const [isNavigating, setIsNavigating] = useState(false);
  const isRoomMode = mode === "partner_room";
  // Les salles se classent de la plus proche à la plus éloignée : on demande la position dès que ce mode est choisi.
  const requestPosition = position.request;
  const positionIdle = position.state.status === "idle";
  useEffect(() => {
    if (isRoomMode && positionIdle) void requestPosition();
  }, [isRoomMode, positionIdle, requestPosition]);
  const [roomId, setRoomId] = useState<string | null>(preselectedChoice.room?.id ?? null);
  const room = options?.rooms.find((r) => r.id === roomId) ?? null;
  const [participants, setParticipants] = useState(preselectedChoice.participantsCount);
  const [equipment, setEquipment] = useState<string[]>(preselectedChoice.requiredEquipment);
  // Étape dépliée (1 lieu, 2 date + créneau, 3 durée) ; null = tout replié (retour depuis la suite du parcours).
  const [step, setStep] = useState<BookingStep | null>(preselectedSlot ? null : 1);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, []),
  );

  const chooseMode = (next: TeachingModeId) => {
    if (next === mode) return;
    setMode(next);
    setSelectedSlotId(null);
    setPickedDate(null);
    // Les durées dépendent du mode : une durée choisie qui n'existe pas pour le nouveau mode est abandonnée.
    const nextDurations = durationsFor(next);
    const keepDuration = durationMinutes !== null && nextDurations.some((d) => d.minutes === durationMinutes);
    if (!keepDuration) setDurationMinutes(null);
    // La salle partenaire demande encore une salle : on reste sur l'étape ; sinon on passe à la durée (ou à la date
    // si la durée est déjà choisie / n'a pas lieu d'être).
    if (next !== "partner_room") setStep(keepDuration || nextDurations.length <= 1 ? 3 : 2);
  };

  const chooseRoom = (id: string) => {
    if (id === roomId) return;
    setRoomId(id);
    setSelectedSlotId(null);
    // Effectif et équipements dépendent de la salle : on repart d'une base valide.
    setParticipants(1);
    setEquipment([]);
  };

  // RM-DUR-009 : une autre durée recalcule les horaires ; un créneau déjà retenu n'est jamais conservé d'office.
  const chooseDuration = (minutes: number) => {
    if (minutes !== effectiveDuration) setSelectedSlotId(null);
    setDurationMinutes(minutes);
    setStep(3);
  };

  const toggleEquipment = (item: string) =>
    setEquipment((current) => (current.includes(item) ? current.filter((e) => e !== item) : [...current, item]));

  // Salle partenaire : créneaux d'UNE date, calculés par le serveur (tuteur ∩ salle, préavis, marges).
  const roomDay = useRoomDaySlots({
    offerId: offer?.id ?? null,
    // Même règle que `selectedDate` ci-dessous : la date affichée est celle dont on charge les créneaux.
    date: pickedDate ?? (preselectedSlot && slotTeachingMode(preselectedSlot, places) === "partner_room" ? preselectedSlot.date : null) ?? todayIso,
    mode,
    roomId,
    // Les créneaux d'une salle ne se calculent qu'une fois la durée choisie.
    durationMinutes: durationDone ? effectiveDuration : null,
  });

  // Jours avec au moins un créneau libre dans le mode choisi → pastille sur le calendrier.
  const availableSlots = useMemo(
    () =>
      isRoomMode
        ? []
        : slots.filter((s) => s.status === "available" && mode !== null && slotTeachingMode(s, places) === mode),
    [slots, mode, places, isRoomMode],
  );
  const markers = useMemo(() => {
    const out: Record<string, DayMarkers> = {};
    for (const slot of availableSlots) out[slot.date] = { availability: true };
    return out;
  }, [availableSlots]);
  const firstAvailableDate = availableSlots.length > 0 ? availableSlots.map((s) => s.date).sort()[0] : null;

  // Date affichée : celle que le demandeur a choisie, sinon celle d'un créneau déjà retenu, sinon la première
  // disponible, sinon aujourd'hui.
  const preselectedDate = preselectedSlot && slotTeachingMode(preselectedSlot, places) === mode ? preselectedSlot.date : null;
  const selectedDate = pickedDate ?? preselectedDate ?? firstAvailableDate ?? todayIso;
  const daySlots = useMemo(
    () =>
      isRoomMode
        ? roomDay.slots
        : slots.filter((s) => s.date === selectedDate && mode !== null && slotTeachingMode(s, places) === mode),
    [slots, selectedDate, mode, places, isRoomMode, roomDay.slots],
  );
  const slotsLoading = isRoomMode ? roomDay.loading : loading && slots.length === 0;
  const slotsError = isRoomMode ? roomDay.error : error;
  const retrySlots = isRoomMode ? roomDay.retry : retry;
  const selectedSlot = daySlots.find((s) => s.id === selectedSlotId) ?? null;
  const nextDate = useMemo(
    () => availableSlots.map((s) => s.date).filter((d) => d > selectedDate).sort()[0] ?? null,
    [availableSlots, selectedDate],
  );

  // Guard: BookDate only makes sense once an offer has been picked
  // (OfferDetail's "Choisir un créneau" sets it before navigating here).
  // Reaching this route without that context — e.g. a stale deep link —
  // bounces to Home instead of rendering a broken screen (AGENTS.md §13).
  useEffect(() => {
    if (!offer) router.replace("/home");
  }, [offer, router]);

  if (!offer) return null;

  const canReserve =
    !!selectedSlot && selectedSlot.status === "available" && !isNavigating && (!isRoomMode || !!room);

  const pickDate = (iso: string) => {
    setPickedDate(iso);
    setSelectedSlotId(null);
  };

  const modeDone = mode !== null && (!isRoomMode || !!room);
  // Les durées arrivent avec les options : si elles apparaissent alors que la date est ouverte, on revient les choisir.
  const openStep: BookingStep | null = step === 3 && !durationDone ? 2 : step;
  const durationLabel = durations.find((d) => d.minutes === effectiveDuration)?.label ?? offer.durationLabel;

  // Le créneau est la dernière étape : une fois choisi, tout se replie et « Réserver » prend le relais.
  const pickSlot = (slot: OfferSlot) => {
    setSelectedSlotId(slot.id);
    setStep(null);
  };

  const modeSummary = mode === null ? t("booking.bookDate.addMode") : isRoomMode && room ? room.name : TEACHING_MODE_LABELS[mode];
  const durationSummary = durationDone ? durationLabel : t("booking.bookDate.addDuration");
  const dateSummary = selectedSlot
    ? `${selectedSlot.dateLabel} · ${selectedSlot.timeRangeLabel}`
    : t("booking.bookDate.addDate");

  const reserve = () => {
    if (!canReserve || !selectedSlot) return;
    setIsNavigating(true);
    setBooking(offer, selectedSlot, {
      durationMinutes: effectiveDuration,
      room: isRoomMode ? room : null,
      participantsCount: isRoomMode ? participants : 1,
      requiredEquipment: isRoomMode ? equipment : [],
    });
    const authenticated = useAuthStore.getState().user !== null;
    router.push(authenticated ? BENEFICIARY_ROUTE : LOGIN_ROUTE);
  };

  const dayLabel = daySlots[0]?.dateLabel ?? formatDayLabel(selectedDate);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <AuthHeader onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn delay={40}>
          <Text className="mb-1 text-[24px] font-bold font-display text-ink">{t("booking.bookDate.chooseYourAppointment")}</Text>
          <Text className="mb-[18px] text-[13.5px] text-ink-soft">
            {t("booking.bookDate.with", { title: offer.title, tutorName: offer.tutorName })}
          </Text>
        </FadeIn>

        <View className="gap-3">
          <FadeIn delay={60}>
            <BookingStepCard
              title={t("booking.bookDate.whereWouldYouLikeThe")}
              label={t("booking.bookDate.modeLabel")}
              summary={modeSummary}
              done={modeDone}
              open={openStep === 1}
              onOpen={() => setStep(1)}
            >
              {availableModes.length === 0 ? (
                optionsState.status === "loading" ? (
                  <View className="h-[64px] rounded-lg bg-line-soft" />
                ) : (
                  <Text className="text-[13.5px] text-ink-soft">{t("booking.bookDate.thisTutorHasNotYet")}</Text>
                )
              ) : (
                <TeachingModePicker available={availableModes} value={mode} onChange={chooseMode} />
              )}
              {optionsState.status === "error" ? (
                <View className="mt-2 flex-row items-center gap-3">
                  <Text className="flex-1 text-[12.5px] text-error">{t("booking.bookDate.thePartnerRoomsCouldNot")}</Text>
                  <PressableScale onPress={retryOptions} accessibilityLabel={t("common.tryAgain")}>
                    <Text className="text-[13px] font-semibold text-primary">{t("common.tryAgain")}</Text>
                  </PressableScale>
                </View>
              ) : null}

              {isRoomMode && options ? (
                <View className="mt-[20px]">
                  <Text className="mb-[6px] ml-0.5 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft">
                    {t("booking.bookDate.whichRoom")}</Text>
                  {position.state.status === "loading" ? (
                    <Text className="mb-2 text-[12.5px] text-ink-soft">{t("booking.bookDate.calculatingDistances")}</Text>
                  ) : position.state.status === "unavailable" ? (
                    <View className="mb-3 flex-row items-center gap-3">
                      <Text className="flex-1 text-[12.5px] leading-[18px] text-ink-soft">
                        {t("booking.bookDate.distancesUnavailable", { message: position.state.message })}
                      </Text>
                      <PressableScale onPress={() => void position.request()} accessibilityLabel={t("booking.bookDate.retryThePosition")}>
                        <Text className="text-[13px] font-semibold text-primary">{t("common.tryAgain")}</Text>
                      </PressableScale>
                    </View>
                  ) : near ? (
                    <Text className="mb-2 text-[12.5px] text-ink-soft">{t("booking.bookDate.sortedFromNearestToFarthest")}</Text>
                  ) : null}
                  <RoomPicker rooms={options.rooms} value={roomId} onChange={chooseRoom} />
                  {room ? (
                    <View className="mt-4 gap-3">
                      <View className="flex-row items-center justify-between rounded-lg border border-line bg-surface shadow-card p-4">
                        <Text className="text-[14px] font-semibold text-ink">{t("common.participants")}</Text>
                        <View className="flex-row items-center gap-4">
                          <PressableScale
                            onPress={() => setParticipants((n) => Math.max(1, n - 1))}
                            disabled={participants <= 1}
                            accessibilityLabel={t("booking.bookDate.oneParticipantLess")}
                          >
                            <Text className="text-[22px] font-bold font-display text-primary">−</Text>
                          </PressableScale>
                          <Text className="min-w-[24px] text-center text-[16px] font-bold text-ink">{participants}</Text>
                          <PressableScale
                            onPress={() => setParticipants((n) => Math.min(room.capacity, n + 1))}
                            disabled={participants >= room.capacity}
                            accessibilityLabel={t("booking.bookDate.oneParticipantMore")}
                          >
                            <Text className="text-[22px] font-bold font-display text-primary">+</Text>
                          </PressableScale>
                        </View>
                      </View>
                      {room.equipment.length > 0 ? (
                        <View>
                          <Text className="mb-[6px] ml-0.5 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft">
                            {t("booking.bookDate.requiredEquipmentOptional")}</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {room.equipment.map((item) => (
                              <Chip key={item} label={item} active={equipment.includes(item)} onPress={() => toggleEquipment(item)} />
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Les autres modes passent seuls à la suite ; la salle demande d'abord salle, effectif, équipements. */}
              {isRoomMode ? (
                <View className="mt-5">
                  <Button label={t("common.continue")} disabled={!modeDone} onPress={() => setStep(durationDone ? 3 : 2)} />
                </View>
              ) : null}
            </BookingStepCard>
          </FadeIn>

          {hasDurationStep ? (
            <FadeIn delay={70}>
              <BookingStepCard
                title={t("booking.bookDate.howLongTitle")}
                label={t("booking.bookDate.durationLabel")}
                summary={durationSummary}
                done={durationDone}
                open={openStep === 2}
                disabled={!modeDone}
                onOpen={() => setStep(2)}
              >
                <DurationPicker durations={durations} value={durationMinutes} onChange={chooseDuration} />
                <Text className="mt-3 text-[12px] text-ink-soft">{t("booking.bookDate.durationHint")}</Text>
              </BookingStepCard>
            </FadeIn>
          ) : null}

          <FadeIn delay={80}>
            <BookingStepCard
              title={t("booking.bookDate.whenTitle")}
              label={t("booking.bookDate.dateLabel")}
              summary={dateSummary}
              done={!!selectedSlot}
              open={openStep === 3}
              disabled={!modeDone || !durationDone}
              onOpen={() => setStep(3)}
            >
              <HabitCalendar
                variant="card"
                selectedDate={selectedDate}
                onSelectDate={pickDate}
                markers={markers}
                minDate={todayIso}
                onViewChange={ensureRange}
              />
              {isRoomMode ? (
                <Text className="mt-2.5 px-1 text-[12px] text-ink-soft">
                  {t("booking.bookDate.chooseADateTheRoom")}</Text>
              ) : (
                <View className="mt-2.5 flex-row items-center gap-2 px-1">
                  <View className="h-[7px] w-[7px] rounded-full bg-accent" />
                  <Text className="text-[12px] text-ink-soft">{t("booking.bookDate.daysWithAvailableSlots")}</Text>
                </View>
              )}

              <View className="mt-[20px]">
                <Text className="mb-[6px] ml-0.5 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-ink-soft">
                  {t("booking.bookDate.slots", { value: dayLabel.charAt(0).toLowerCase() + dayLabel.slice(1) })}
                </Text>
                {slotsError ? (
                  <View className="flex-row items-center gap-3">
                    <Text className="flex-1 text-[13.5px] text-error">{slotsError}</Text>
                    <PressableScale onPress={retrySlots} accessibilityLabel={t("common.tryAgain")}>
                      <Text className="text-[13.5px] font-semibold text-primary">{t("common.tryAgain")}</Text>
                    </PressableScale>
                  </View>
                ) : slotsLoading ? (
                  <View className="gap-[10px]">
                    {[0, 1].map((i) => (
                      <View key={i} className="h-[56px] rounded-lg bg-line-soft" />
                    ))}
                  </View>
                ) : daySlots.length === 0 ? (
                  <View className="rounded-2xl border border-line bg-surface shadow-card">
                    <EmptyState
                      compact
                      illustration="calendar"
                      title={t("booking.bookDate.noSlotsTitle")}
                      message={
                        isRoomMode
                          ? t("booking.bookDate.noSlotsThatDayIn")
                          : slots.length === 0 && !loading
                            ? t("booking.bookDate.noSlotsAvailableAtThe")
                            : undefined
                      }
                      actionLabel={nextDate ? t("booking.bookDate.nextAvailability", { toLowerCase: formatDayLabel(nextDate).toLowerCase() }) : undefined}
                      onAction={nextDate ? () => pickDate(nextDate) : undefined}
                    />
                  </View>
                ) : (
                  <View className="gap-[10px]">
                    {daySlots.map((slot) => (
                      <TimeSlotRow
                        key={slot.id}
                        slot={slot}
                        selected={slot.id === selectedSlotId}
                        onPress={() => pickSlot(slot)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </BookingStepCard>
          </FadeIn>
        </View>

        <FadeIn delay={160}>
          <Text className="mt-4 text-[12px] leading-[18px] text-ink-faint">
            {t("booking.bookDate.availabilityIsCheckedByEduloc", { minNoticeHours, value: isRoomMode
              ? t("booking.bookDate.choosingARoomDoesNot")
              : "" })}
          </Text>
        </FadeIn>
      </ScrollView>

      <View
        className="border-t border-line-soft bg-surface px-5 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 22) }}
      >
        <Button label={t("booking.bookDate.bookThisSlot")} disabled={!canReserve} onPress={reserve} />
      </View>
    </View>
  );
}

type TimeSlotRowProps = {
  slot: OfferSlot;
  selected: boolean;
  onPress: () => void;
};

function TimeSlotRow({ slot, selected, onPress }: TimeSlotRowProps) {
  const { t } = useTranslation();
  const booked = slot.status === "unavailable";
  const range = slot.timeRangeLabel;

  return (
    <PressableScale
      onPress={onPress}
      disabled={booked}
      accessibilityLabel={booked ? t("booking.bookDate.slotTaken", { range }) : range}
    >
      <View
        className={[
          "flex-row items-center justify-between rounded-lg border p-4",
          !booked && selected ? "border-primary bg-primary-tint" : "border-line bg-surface",
        ].join(" ")}
      >
        <View className="flex-row items-center gap-[10px]">
          <ClockIcon size={16} color={!booked && selected ? "#332E86" : "#585B78"} />
          <Text className="text-[14.5px] font-bold text-ink">{range}</Text>
        </View>
        {booked ? (
          <Text className="text-[12px] font-semibold text-ink-faint">{t("booking.bookDate.taken")}</Text>
        ) : selected ? (
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
            <CheckIcon size={11} color="#fff" />
          </View>
        ) : (
          <View className="h-5 w-5 rounded-full border-2 border-line" />
        )}
      </View>
    </PressableScale>
  );
}
