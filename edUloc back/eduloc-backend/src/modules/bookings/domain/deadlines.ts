/**
 * Échéance « maintenant + durée », jamais après le début de la séance : une demande ou un paiement n'a plus de sens
 * une fois le cours commencé. Sert à l'expiration d'une demande (durée choisie par le Demandeur) et au délai de paiement
 * qui suit la confirmation (la même durée).
 */
export function deadlineFrom(now: Date, minutes: number, startAt: Date): Date {
  return new Date(Math.min(now.getTime() + minutes * 60_000, startAt.getTime()));
}
