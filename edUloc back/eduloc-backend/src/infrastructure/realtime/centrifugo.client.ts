import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../../core/config/app.config';
import { RealtimePublisher } from './realtime-publisher.port';

@Injectable()
export class CentrifugoClient implements RealtimePublisher {
  private readonly logger = new Logger(CentrifugoClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly cfg: AppConfig,
  ) {}

  async publish(channel: string, data: unknown, idempotencyKey: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.cfg.centrifugoUrl}/api/publish`,
          { channel, data, idempotency_key: idempotencyKey },
          { headers: { 'X-API-Key': this.cfg.centrifugoApiKey }, timeout: 3000 },
        ),
      );
    } catch (err) {
      // Une publication échouée ne remet pas l'événement en file : le client
      // se resynchronisera via l'historique Centrifugo (force_recovery).
      this.logger.warn(`publish ${channel} échoué: ${(err as Error).message}`);
    }
  }

  personalChannel(userId: string): string {
    return `personal:#${userId}`;
  }

  slotsChannel(tutorProfileId: string): string {
    return `slots:${tutorProfileId}`;
  }
}
