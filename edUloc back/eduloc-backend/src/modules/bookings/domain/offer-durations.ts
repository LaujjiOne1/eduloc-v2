import { AvailabilityRule, SlotPolicy, TeachingMode } from './slot-policy';

/** Durées réservables d'une offre fixées par le Tuteur : la durée par défaut plus celles qu'il a configurées (spec 4.3). */
export function allowedDurations(offer: { durationMinutes: number; durationOptions?: number[] | null }): number[] {
  return [...new Set([offer.durationMinutes, ...(offer.durationOptions ?? [])])].sort((a, b) => a - b);
}

/** Pas de choix de la durée, et plus courte durée proposée DEPUIS une plage (au-delà, on ajoute des pas de 30 min). */
export const DURATION_STEP_MINUTES = 30;
export const FLEX_MIN_DURATION_MINUTES = 60;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Durées qu'une plage de `windowMinutes` permet : de 1 h jusqu'à sa longueur, par pas de 30 min. Vide si elle fait moins d'1 h. */
export function durationsForWindow(windowMinutes: number): number[] {
  const out: number[] = [];
  for (let m = FLEX_MIN_DURATION_MINUTES; m <= windowMinutes; m += DURATION_STEP_MINUTES) out.push(m);
  return out;
}

/**
 * Durées qu'un Demandeur peut choisir pour une offre : déduites de la plus longue plage de disponibilité du Tuteur
 * (de 1 h à la longueur de la plage, par pas de 30 min), pour le mode demandé si précisé. Le Tuteur ne saisit donc
 * que début et fin de plage. Les durées qu'il avait configurées sur l'offre restent valables tant qu'elles tiennent
 * dans cette plage ; sans plage d'au moins 1 h, seules ces durées subsistent.
 * Ne dit pas qu'un créneau existe : chaque séance doit encore tenir ENTIÈREMENT dans une plage libre.
 */
export function bookableDurations(
  offer: { id: string; durationMinutes: number; durationOptions?: number[] | null },
  rules: AvailabilityRule[],
  mode?: TeachingMode,
): number[] {
  const legacy = allowedDurations(offer);
  const usable = rules.filter((r) => r.isActive && (!r.offerId || r.offerId === offer.id) && (!mode || SlotPolicy.coversMode(r, mode)));
  const longest = Math.max(0, ...usable.map((r) => toMinutes(r.endTime) - toMinutes(r.startTime)));
  const derived = durationsForWindow(longest);
  if (derived.length === 0) return legacy;
  return [...new Set([...derived, ...legacy.filter((m) => m <= longest)])].sort((a, b) => a - b);
}
