import { useCallback, useEffect, useRef } from "react";

import { clearLessonReminders, syncLessonReminders } from "@/lib/lesson-reminders";
import { isApprovedTutor } from "@/lib/auth-routing";
import { useRealtimeEvent } from "@/realtime/use-realtime-event";
import { BookingService } from "@/services/booking.service";
import { useAuthStore } from "@/store/auth.store";
import type { Booking } from "@/types/booking";

/** Rafale d'événements (acceptation, annulation…) : une seule relecture. */
const DEBOUNCE_MS = 1_500;

/**
 * Tient à jour les rappels de cours programmés sur l'appareil (voir `syncLessonReminders`) : au démarrage, quand le
 * paramètre d'alarme change, à chaque événement de réservation et au retour de connexion (`realtime.resync`).
 * Ne lève jamais : un échec réseau garde simplement les rappels déjà programmés.
 */
export function useLessonReminderSync(): void {
  const alarm = useAuthStore((s) => s.user?.lessonAlarm);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const mine = await BookingService.getMyBookings(["confirmed"]);
      const asTutor: Booking[] = isApprovedTutor(user) ? await BookingService.getTutorBookings(["confirmed"]) : [];
      const unique = new Map([...mine, ...asTutor].map((b) => [b.id, b] as const));
      await syncLessonReminders([...unique.values()], user.lessonAlarm);
    } catch {
      // hors ligne : on garde les rappels existants
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), DEBOUNCE_MS);
  }, [sync]);

  // Au démarrage et à chaque changement du paramètre d'alarme (activée / délai) : tout est reprogrammé.
  useEffect(() => {
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule, alarm?.enabled, alarm?.leadMinutes]);

  useRealtimeEvent(["booking.", "realtime.resync"], schedule);

  // À la déconnexion ce composant est démonté avec la session : on efface les rappels de ce compte.
  useEffect(() => () => void clearLessonReminders(), []);
}
