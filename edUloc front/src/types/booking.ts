import type { FormatId, LevelRef } from "./common";
import type { Offer, OfferSlot } from "./offer";
import type { DifficultyId, Relationship } from "./beneficiary";

export type BookingStatus = "pending" | "confirmed" | "refused" | "cancelled" | "in_progress" | "completed";
export type TeachingModeId = "online" | "at_home_beneficiary" | "at_home_tutor" | "public_place" | "partner_room";

/** Sous-ensemble de Offer figé dans la réservation (snapshot titre/prix). */
export type BookingOffer = Pick<
  Offer,
  | "id"
  | "tutorId"
  | "tutorName"
  | "tutorInitial"
  | "tutorGender"
  | "tutorPhotoUrl"
  | "title"
  | "subjectLabel"
  | "levelLabel"
  | "durationMinutes"
  | "durationLabel"
  | "format"
  | "formats"
  | "location"
  | "priceLabel"
>;

export interface BookingBeneficiary {
  id: string; // [v1+]
  firstName: string;
  lastName: string;
  relationship: Relationship; // [v1+]
  relationLabel: string | null;
  level: LevelRef | null;
  difficulty: DifficultyId | null; // [v1~] était string libre
  objective: "remedial" | "ongoing" | "excellence" | null; // objectif pédagogique du bénéficiaire
}

/** Autre demande en attente sur le même horaire (vue tuteur) : accepter l'une refuse automatiquement les autres. */
export interface CompetingRequest {
  id: string;
  beneficiaryFirstName: string;
  requesterName: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  viewerRole: "requester" | "tutor"; // [v1+]
  offer: BookingOffer; // [v1~] n'est plus l'Offer complète (pas de slots/description)
  slot: OfferSlot; // reconstruit depuis startAt/endAt
  beneficiary: BookingBeneficiary;
  requester: { id: string; firstName: string; lastName: string }; // [v1+] vue tuteur
  teachingMode: TeachingModeId; // [v1+]
  locationLabel: string | null; // [v1+]
  locationAddress: string | null; // [v1+] visible après confirmation
  /** Salle partenaire : zone approximative seulement ; l'adresse exacte est dans locationAddress une fois confirmée. */
  room: { id: string; name: string; zoneLabel: string | null } | null;
  participantsCount: number;
  /** Tarif de la salle pour la durée (information). */
  roomFeeLabel: string | null;
  /** Détail du prix payé (absent des anciennes réservations). */
  pricing: BookingPricing | null;
  /** Instructions d'accès : présentes seulement une fois la séance confirmée. */
  accessInstructions: string | null;
  note: string; // = requesterNote (D-05)
  conversationId: string | null; // [v1+]
  refusalReason: string | null; // [v1+]
  cancellationReason: string | null; // [v1+]
  cancelledBy: "requester" | "tutor" | "system" | "admin" | null; // [v1+]
  hasReview: boolean; // [v1+]
  /** Échéance d'une demande en attente (ISO) ; null si elle ne l'est plus ou n'en a pas. */
  expiresAt: string | null;
  /** Demande refusée par le système faute de réponse du tuteur à temps (refusalReason = REQUEST_EXPIRED). */
  expired: boolean;
  /** Confirmée mais pas encore payée : le code de séance n'est donné qu'après paiement. */
  paymentRequired: boolean;
  /** Échéance de paiement (ISO) d'une réservation confirmée non payée ; null sinon. */
  paymentDueAt: string | null;
  /** Annulée par le système faute de paiement à temps (cancellationReason = PAYMENT_EXPIRED). */
  paymentExpired: boolean;
  competingRequests: CompetingRequest[]; // [v1+] vue tuteur, demandes en attente seulement
  canReview: boolean; // [v1+] dérivé
  createdAt: string;
  sessionStartedAt?: string; // = startedAt
  sessionCompletedAt?: string; // [v1+] = completedAt
  sessionDurationLabel?: string;
  sessionMode?: FormatId; // dérivé de teachingMode
}

/** [v1~] Le bénéficiaire est référencé par id (créé avant via BeneficiaryService). */
export interface BookingRequest {
  /**
   * Clé d'idempotence (en-tête Idempotency-Key) : la MÊME pour toutes les tentatives d'une même demande,
   * afin qu'un renvoi après coupure réseau ne crée jamais de doublon.
   */
  idempotencyKey?: string;
  offerId: string;
  slot: Pick<OfferSlot, "availabilityId" | "startAt" | "placeId">;
  beneficiaryId: string;
  teachingMode: TeachingModeId;
  beneficiaryAddress?: string;
  note?: string;
  /** Salle partenaire (obligatoire si teachingMode = "partner_room"). */
  roomId?: string;
  /** Durée choisie parmi celles de l'offre. */
  durationMinutes?: number;
  participantsCount?: number;
  requiredEquipment?: string[];
  /** Position approximative du lieu du cours (cours chez le bénéficiaire). */
  beneficiaryCoordinates?: { latitude: number; longitude: number };
  /** Blocage du créneau obtenu au devis : la création le consomme. */
  holdId?: string;
  /** Durée de validité de la demande en minutes, choisie par le demandeur (le serveur borne et fait foi). */
  validityMinutes?: number;
}

/** Une ligne du détail du prix, déjà formatée (« 25 000 Ar »). */
export interface PriceBreakdownLine {
  key: "tutor" | "travel" | "room" | "service";
  label: string;
  amountLabel: string;
  amount: number;
}

export interface BookingPricing {
  lines: PriceBreakdownLine[];
  totalLabel: string;
  total: number;
  serviceFeeRatePercent: number;
}

/** Devis : prix détaillé et créneau bloqué jusqu'à `expiresAt` (ISO). */
export interface BookingQuote {
  holdId: string;
  expiresAt: string;
  pricing: BookingPricing;
}
