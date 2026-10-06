export interface RealtimePublisher {
  publish(channel: string, data: unknown, idempotencyKey: string): Promise<void>;
  personalChannel(userId: string): string;
}

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');
