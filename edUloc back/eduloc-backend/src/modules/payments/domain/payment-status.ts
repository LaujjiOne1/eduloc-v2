import { DomainError } from '../../../common/errors/domain-errors';

export type PaymentStatusValue = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

/** Réservation payable : confirmée par le tuteur (ou déjà en cours / terminée). À confirmer par le responsable produit. */
export const PAYABLE_BOOKING_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const;

export class ServiceUnavailableError extends DomainError { readonly status = 503; }

/**
 * Statuts du service de paiement → statuts internes (MM-02). Tout ce qui n'est pas un résultat FINAL reste PENDING : un
 * délai, une demande acceptée (202) ou un défi 3-D Secure en cours ne sont jamais un échec ni un succès.
 */
export function toInternalStatus(external: string): PaymentStatusValue | null {
  switch (external.trim().toUpperCase()) {
    case 'SUCCEEDED': return 'SUCCEEDED';
    case 'FAILED': return 'FAILED';
    case 'CANCELLED': case 'CANCELED': return 'CANCELLED';
    case 'EXPIRED': return 'EXPIRED';
    case 'PENDING': case 'PROCESSING': case 'REQUIRES_ACTION': case 'REQUIRES_PAYMENT_METHOD': return 'PENDING';
    default: return null;
  }
}

export interface Transition {
  /** Nouveau statut à enregistrer ; null = rien à changer (même statut, ou résultat déjà définitif). */
  next: PaymentStatusValue | null;
  /** Succès confirmé après un échec / une annulation / une expiration : l'argent a bougé, un humain doit regarder (SEC-11). */
  anomaly: boolean;
}

/**
 * Règles d'évolution :
 *  - SUCCEEDED est terminal (un remboursement sera un autre objet, pas un retour en arrière) ;
 *  - un succès confirmé l'emporte toujours, même après FAILED / CANCELLED / EXPIRED (le prestataire fait foi), mais il est signalé ;
 *  - FAILED / CANCELLED / EXPIRED ne s'échangent pas entre eux et ne repassent pas à PENDING.
 */
export function decideTransition(current: PaymentStatusValue, incoming: PaymentStatusValue): Transition {
  if (current === incoming) return { next: null, anomaly: false };
  if (current === 'SUCCEEDED') return { next: null, anomaly: incoming !== 'PENDING' };
  if (incoming === 'SUCCEEDED') return { next: 'SUCCEEDED', anomaly: current !== 'PENDING' };
  if (current === 'PENDING') return { next: incoming, anomaly: false };
  return { next: null, anomaly: false };
}
