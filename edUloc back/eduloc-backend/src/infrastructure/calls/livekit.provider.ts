import { Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { AppConfig } from '../../core/config/app.config';
import { CallProvider } from './call-provider.port';

@Injectable()
export class LiveKitProvider implements CallProvider {
  private readonly roomService: RoomServiceClient;

  constructor(private readonly cfg: AppConfig) {
    this.roomService = new RoomServiceClient(
      cfg.livekitUrl,
      cfg.livekitApiKey,
      cfg.livekitApiSecret,
    );
  }

  async ensureRoom(roomName: string, participantIds: string[]): Promise<void> {
    // getOrCreate : idempotent, ne touche pas à une room existante.
    await this.roomService.createRoom({
      name: roomName,
      emptyTimeout: 300,
      maxParticipants: 2,
      metadata: JSON.stringify({ participants: participantIds }),
    }).catch(async (err: Error) => {
      if (err.message?.includes('already exists')) return;
      throw err;
    });
  }

  async participantToken(roomName: string, participantId: string, participantName: string): Promise<string> {
    const at = new AccessToken(this.cfg.livekitApiKey, this.cfg.livekitApiSecret, {
      identity: participantId,
      name: participantName,
      ttl: '1h',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return at.toJwt();
  }
}
