import { UnprocessableError } from '../../../common/errors/domain-errors';

export class SessionPolicy {
  /** Fenêtre de démarrage : 15 min avant startAt → endAt. */
  static assertWithinStartWindow(startAt: Date, endAt: Date, now: Date): void {
    if (now.getTime() < startAt.getTime() - 15 * 60_000) {
      throw new UnprocessableError('SESSION_TOO_EARLY', 'La séance ne peut pas encore démarrer.');
    }
    if (now.getTime() > endAt.getTime()) {
      throw new UnprocessableError('SESSION_TOO_LATE', 'La fenêtre de démarrage est dépassée.');
    }
  }
}
