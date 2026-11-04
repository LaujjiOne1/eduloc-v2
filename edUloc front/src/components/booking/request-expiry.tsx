import { Text, View } from "react-native";

import { ClockIcon } from "@/components/icons";
import { useCountdown } from "@/hooks/use-countdown";
import { remainingLabel } from "@/lib/countdown";
import type { Booking } from "@/types/booking";
import { useTranslation } from "react-i18next";

/** Moins de cette durée avant l'échéance : le compte à rebours passe en alerte. */
const URGENT_MS = 3_600_000;

/** Temps restant avant l'échéance d'une demande (null = pas d'échéance : demande déjà traitée ou antérieure). */
function useExpiry(expiresAt: string | null) {
  const { msLeft, expired } = useCountdown(expiresAt);
  return { msLeft, expired, urgent: msLeft !== null && msLeft < URGENT_MS };
}

/** « Expire dans 5 h 12 min » d'une demande en attente ; rien si la demande n'a pas d'échéance. */
export function useRequestExpiry(booking: Booking) {
  return useExpiry(booking.status === "pending" ? booking.expiresAt : null);
}

type ExpiryCardProps = {
  expiresAt: string | null;
  /** Demande déjà refusée par le système faute de réponse. */
  expiredFlag?: boolean;
  /** Ligne sous le compte à rebours (l'offre côté tuteur, l'explication côté demandeur). */
  detail: string;
  /** Explication quand la demande a expiré. */
  expiredDetail: string;
  /** Titre au-dessus du compte à rebours (ex. « Paiement requis ») et titre une fois le délai dépassé. */
  heading?: string;
  expiredTitle?: string;
};

/** Carte « Expire dans … » (ou « Demande expirée ») : une seule présentation pour le tuteur et le demandeur. */
export function ExpiryCountdownCard({ expiresAt, expiredFlag = false, detail, expiredDetail, heading, expiredTitle }: ExpiryCardProps) {
  const { t } = useTranslation();
  const { msLeft, expired, urgent } = useExpiry(expiredFlag ? null : expiresAt);

  if (expiredFlag || expired) {
    return (
      <View className="mb-[14px] rounded-lg border border-line bg-paper-alt p-4" accessibilityRole="alert">
        <View className="flex-row items-center gap-2">
          <ClockIcon size={16} color="#585B78" />
          <Text className="flex-1 text-[14px] font-bold text-ink-soft">{expiredTitle ?? t("booking.requestExpiry.expired")}</Text>
        </View>
        <Text className="mt-1.5 text-[13px] leading-[19px] text-ink-soft">{expiredDetail}</Text>
      </View>
    );
  }
  if (msLeft === null) return null;

  return (
    <View
      className={["mb-[14px] rounded-lg border p-4", urgent ? "border-warning/40 bg-warning-tint" : "border-line bg-surface shadow-card"].join(" ")}
      accessibilityRole="timer"
    >
      {heading ? <Text className="mb-1 text-[12.5px] font-bold uppercase tracking-[0.04em] text-ink-soft">{heading}</Text> : null}
      <View className="flex-row items-center gap-2">
        <ClockIcon size={16} color={urgent ? "#D4890A" : "#332E86"} />
        <Text className={["flex-1 text-[15px] font-bold", urgent ? "text-warning" : "text-primary"].join(" ")}>
          {t("booking.requestExpiry.expiresIn", { time: remainingLabel(msLeft) })}
        </Text>
      </View>
      <Text className="mt-1.5 text-[13px] leading-[19px] text-ink-soft" numberOfLines={3}>{detail}</Text>
    </View>
  );
}

/** Bandeau d'une demande, côté tuteur (avec l'offre concernée) comme côté demandeur (avec ce qui se passe à l'échéance). */
export function RequestExpiryBanner({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const forTutor = booking.viewerRole === "tutor";
  return (
    <ExpiryCountdownCard
      expiresAt={booking.status === "pending" ? booking.expiresAt : null}
      expiredFlag={booking.expired}
      detail={forTutor ? t("booking.requestExpiry.offer", { title: booking.offer.title }) : t("booking.requestExpiry.requesterHint")}
      expiredDetail={forTutor ? t("booking.requestExpiry.expiredHint") : t("booking.requestExpiry.requesterExpiredHint")}
    />
  );
}

/** Version courte pour les listes : « Expire dans 5 h 12 min » (ou « Demande expirée »). */
export function RequestExpiryInline({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const { msLeft, expired, urgent } = useRequestExpiry(booking);
  if (booking.expired || expired) {
    return <Text className="mt-3 text-[12.5px] font-semibold text-ink-soft">{t("booking.requestExpiry.expired")}</Text>;
  }
  if (msLeft === null) return null;
  return (
    <View className="mt-3 flex-row items-center gap-[6px]">
      <ClockIcon size={14} color={urgent ? "#D4890A" : "#585B78"} />
      <Text className={["text-[12.5px] font-semibold", urgent ? "text-warning" : "text-ink-soft"].join(" ")}>
        {t("booking.requestExpiry.expiresIn", { time: remainingLabel(msLeft) })}
      </Text>
    </View>
  );
}

/** Réservation confirmée mais pas payée : « Paiement requis — expire dans … », pour le demandeur comme pour le tuteur. */
export function PaymentDueBanner({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const forTutor = booking.viewerRole === "tutor";
  return (
    <ExpiryCountdownCard
      heading={forTutor ? t("booking.paymentDue.tutorHeading") : t("booking.paymentDue.heading")}
      expiresAt={booking.paymentDueAt}
      detail={forTutor ? t("booking.paymentDue.tutorDetail") : t("booking.paymentDue.requesterDetail")}
      expiredTitle={t("booking.paymentDue.expiredTitle")}
      expiredDetail={t("booking.paymentDue.expiredDetail")}
    />
  );
}

/** Version courte pour les listes d'une réservation confirmée à payer. */
export function PaymentDueInline({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const { msLeft, expired, urgent } = useExpiry(booking.paymentDueAt);
  if (msLeft === null) return null;
  return (
    <View className="mt-3 flex-row items-center gap-[6px]">
      <ClockIcon size={14} color={urgent || expired ? "#D4890A" : "#585B78"} />
      <Text className={["text-[12.5px] font-semibold", urgent || expired ? "text-warning" : "text-ink-soft"].join(" ")}>
        {expired ? t("booking.paymentDue.expiredTitle") : t("booking.paymentDue.inline", { time: remainingLabel(msLeft) })}
      </Text>
    </View>
  );
}
