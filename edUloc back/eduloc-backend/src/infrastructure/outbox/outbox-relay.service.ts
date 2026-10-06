import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { REALTIME_PUBLISHER, RealtimePublisher } from '../realtime/realtime-publisher.port';
import { PUSH_PROVIDER, PushProvider } from '../push/push-provider.port';

interface RelayRow {
  id: string;
  aggregateId: string;
  eventType: string;
  recipientIds: string[];
  payload: unknown;
  pushTitle: string | null;
  pushBody: string | null;
  cacheKeys: string[];
  attempts: number;
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  @Cron('*/5 * * * * *')
  async relay(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const events = await tx.$queryRaw<RelayRow[]>`
          SELECT id, "aggregateId", "eventType", "recipientIds", payload,
                 "pushTitle", "pushBody", "cacheKeys", attempts
          FROM outbox_events
          WHERE "processedAt" IS NULL
            AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
          ORDER BY "createdAt" ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED`;

        for (const ev of events) {
          try {
            const data = { eventId: ev.id, type: ev.eventType, aggregateId: ev.aggregateId, payload: ev.payload };
            for (const userId of ev.recipientIds) {
              await this.realtime.publish(this.realtime.personalChannel(userId), data, ev.id);
            }
            if (ev.pushTitle && ev.pushBody && ev.recipientIds.length) {
              const tokens = await tx.deviceToken.findMany({
                where: { userId: { in: ev.recipientIds } },
                select: { token: true },
              });
              await this.push.sendToTokens(tokens.map((t) => t.token), {
                title: ev.pushTitle,
                body: ev.pushBody,
                data: { eventId: ev.id, type: ev.eventType },
              });
            }
            if (ev.cacheKeys.length) await this.redis.del(...ev.cacheKeys);
            await tx.outboxEvent.update({ where: { id: ev.id }, data: { processedAt: new Date() } });
          } catch (err) {
            await tx.outboxEvent.update({
              where: { id: ev.id },
              data: {
                attempts: ev.attempts + 1,
                lastError: (err as Error).message.slice(0, 500),
                lockedUntil: new Date(Date.now() + Math.min(60_000, 2 ** ev.attempts * 1000)),
              },
            });
            this.logger.warn(`outbox ${ev.id}: ${(err as Error).message}`);
          }
        }
      }, { timeout: 15_000 });
    } finally {
      this.running = false;
    }
  }
}
