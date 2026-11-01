import { Platform } from "react-native";

import { ensureAndroidChannels, notificationsModule } from "@/lib/push";
import type { LessonAlarm } from "@/types/auth";
import type { Booking } from "@/types/booking";
import { t } from "@/i18n";

/** Préfixe commun : le serveur envoie sa propre notification avec le MÊME `tag`, Android remplace au lieu de doubler. */
export const REMINDER_PREFIX = "reminder:";
export const reminderIdentifier = (bookingId: string) => `${REMINDER_PREFIX}${bookingId}`;

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Indian/Antananarivo" });

const leadLabel = (minutes: number) => (minutes >= 60 ? t("lib.lessonReminders.leadHour") : t("lib.lessonReminders.leadMinutes", { count: minutes }));

/**
 * Rappels de cours PROGRAMMÉS SUR L'APPAREIL (alarme Android) : ils sonnent à l'heure même sans internet, sans forfait et
 * application fermée, avec l'icône et la couleur edUloc. Le serveur envoie aussi son push de rappel (filet de sécurité quand
 * l'application n'a pas été ouverte depuis la confirmation du cours) ; les deux portent le même identifiant, donc une seule
 * notification reste affichée.
 *
 * Réécrit la liste à chaque appel : les rappels de cours annulés, refusés ou déplacés disparaissent, les nouveaux apparaissent.
 */
export async function syncLessonReminders(bookings: Booking[], alarm: LessonAlarm | undefined, now = Date.now()): Promise<number> {
  const Notifications = notificationsModule();
  if (!Notifications || Platform.OS === "web") return 0;

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") return 0;
    await ensureAndroidChannels(Notifications);

    const wanted = new Map<string, { date: Date; booking: Booking }>();
    if (alarm?.enabled) {
      for (const booking of bookings) {
        if (booking.status !== "confirmed") continue;
        const date = new Date(new Date(booking.slot.startAt).getTime() - alarm.leadMinutes * 60_000);
        // Déjà dans la fenêtre de rappel (cours confirmé tardivement) : le serveur et la bannière s'en chargent maintenant.
        if (date.getTime() <= now + 5_000) continue;
        wanted.set(reminderIdentifier(booking.id), { date, booking });
      }
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.identifier.startsWith(REMINDER_PREFIX) && !wanted.has(item.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }

    for (const [identifier, { date, booking }] of wanted) {
      const time = timeFormat.format(new Date(booking.slot.startAt));
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: t("lib.lessonReminders.title", { lead: leadLabel(alarm?.leadMinutes ?? 15) }),
          body:
            booking.viewerRole === "tutor"
              ? t("lib.lessonReminders.bodyTutor", { student: booking.beneficiary.firstName, subject: booking.offer.subjectLabel, time })
              : t("lib.lessonReminders.bodyRequester", { subject: booking.offer.subjectLabel, time }),
          data: { type: "booking.reminder", bookingId: booking.id },
          color: "#332E86",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: "reminders" },
      });
    }
    return wanted.size;
  } catch {
    // Pas de rappel local (permission, module absent) : le serveur garde la main.
    return 0;
  }
}

/** À la déconnexion : les rappels de ce compte ne doivent plus sonner sur cet appareil. */
export async function clearLessonReminders(): Promise<void> {
  const Notifications = notificationsModule();
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((s) => s.identifier.startsWith(REMINDER_PREFIX)).map((s) => Notifications.cancelScheduledNotificationAsync(s.identifier)));
  } catch {
    // rien à nettoyer
  }
}
