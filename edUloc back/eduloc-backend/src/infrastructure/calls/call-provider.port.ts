export interface CallProvider {
  /** Crée (idempotent) la room côté fournisseur. */
  ensureRoom(roomName: string, participantIds: string[]): Promise<void>;
  /** Token d'accès participant (1 h). */
  participantToken(roomName: string, participantId: string, participantName: string): Promise<string>;
}

export const CALL_PROVIDER = Symbol('CALL_PROVIDER');
