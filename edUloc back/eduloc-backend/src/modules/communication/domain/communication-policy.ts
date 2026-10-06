export type RelationState = 'NONE' | 'PENDING' | 'ACTIVE' | 'RECENT' | 'READ_ONLY';

export interface RelationFacts {
  hasPending: boolean;
  hasConfirmedOrInProgress: boolean;
  lastCompletedAt: Date | null;
  tutorSuspended: boolean;
}

const RECENT_WINDOW_MS = 30 * 86_400_000;

export class CommunicationPolicy {
  static relation(facts: RelationFacts, now: Date): RelationState {
    if (facts.tutorSuspended) return 'READ_ONLY';
    if (facts.hasConfirmedOrInProgress) return 'ACTIVE';
    if (facts.hasPending) return 'PENDING';
    if (facts.lastCompletedAt && now.getTime() - facts.lastCompletedAt.getTime() < RECENT_WINDOW_MS) return 'RECENT';
    return 'READ_ONLY';
  }

  /** Vocal / document : autorisé si ACTIVE, PENDING (quota) ou RECENT. */
  static canSend(relation: RelationState): boolean {
    return relation === 'ACTIVE' || relation === 'PENDING' || relation === 'RECENT';
  }

  /** Quota UC-F02 : 3 vocaux max du demandeur tant que le tuteur n'a pas répondu. */
  static canSendVoice(
    relation: RelationState,
    isRequester: boolean,
    requesterVoiceCount: number,
    tutorHasReplied: boolean,
  ): boolean {
    if (!CommunicationPolicy.canSend(relation)) return false;
    if (isRequester && relation === 'PENDING' && !tutorHasReplied && requesterVoiceCount >= 3) return false;
    return true;
  }

  /** Appel : UNIQUEMENT sur séance CONFIRMED / IN_PROGRESS (décision attachment n°4). */
  static canCall(relation: RelationState): boolean {
    return relation === 'ACTIVE';
  }
}
