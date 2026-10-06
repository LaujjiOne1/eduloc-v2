import { ForbiddenTransitionError, InvalidTransitionError } from '../../../common/errors/domain-errors';

export type BookingState = 'PENDING' | 'CONFIRMED' | 'REFUSED' | 'CANCELLED' | 'IN_PROGRESS' | 'COMPLETED';
export type BookingActor = 'REQUESTER' | 'TUTOR' | 'SYSTEM' | 'ADMIN';

const TRANSITIONS: Record<BookingState, Partial<Record<BookingState, BookingActor[]>>> = {
  PENDING:     { CONFIRMED: ['TUTOR'], REFUSED: ['TUTOR', 'SYSTEM'], CANCELLED: ['REQUESTER', 'ADMIN'] },
  CONFIRMED:   { CANCELLED: ['REQUESTER', 'TUTOR', 'ADMIN', 'SYSTEM'], IN_PROGRESS: ['TUTOR'] },
  IN_PROGRESS: { COMPLETED: ['TUTOR', 'SYSTEM'] },
  REFUSED:     {},
  CANCELLED:   {},
  COMPLETED:   {},
};

export class BookingStateMachine {
  static assertCanTransition(from: BookingState, to: BookingState, actor: BookingActor): void {
    const allowed = TRANSITIONS[from]?.[to];
    if (!allowed) throw new InvalidTransitionError(from, to);
    if (!allowed.includes(actor)) throw new ForbiddenTransitionError(from, to, actor);
  }

  static canTransition(from: BookingState, to: BookingState, actor: BookingActor): boolean {
    return (TRANSITIONS[from]?.[to] ?? []).includes(actor);
  }
}
