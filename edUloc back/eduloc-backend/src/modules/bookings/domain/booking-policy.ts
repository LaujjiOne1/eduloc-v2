import { UnprocessableError } from '../../../common/errors/domain-errors';

/** Règles d'arbitrage de l'attachement : prévenance ≥ 2 h, annulation gratuite ≥ 24 h. */
export class BookingPolicy {
  static assertMinNotice(startAt: Date, now: Date, minNoticeHours: number): void {
    if (startAt.getTime() - now.getTime() < minNoticeHours * 3_600_000) {
      throw new UnprocessableError('SLOT_TOO_SOON', `Réservation impossible à moins de ${minNoticeHours} h.`);
    }
  }

  static assertCancellationAllowed(startAt: Date, now: Date, reason: string | undefined, freeNoticeHours: number): void {
    const msToStart = startAt.getTime() - now.getTime();
    if (msToStart < 2 * 3_600_000) {
      throw new UnprocessableError('CANCELLATION_TOO_LATE', 'Annulation impossible à moins de 2 h de la séance.');
    }
    if (msToStart < freeNoticeHours * 3_600_000 && !reason?.trim()) {
      throw new UnprocessableError(
        'CANCELLATION_REQUIRES_JUSTIFICATION',
        `Moins de ${freeNoticeHours} h avant la séance : une justification est obligatoire.`,
      );
    }
  }
}
