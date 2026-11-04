import { t } from "@/i18n";

/** 18 720 000 ms → « 5 h 12 min » ; sous l'heure « 12 min 30 s » ; sous la minute « 45 s ». */
export function remainingLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return t("lib.countdown.hoursMinutes", { hours, minutes });
  if (minutes > 0) return t("lib.countdown.minutesSeconds", { minutes, seconds });
  return t("lib.countdown.seconds", { seconds });
}
