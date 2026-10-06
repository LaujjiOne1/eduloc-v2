import { Injectable } from '@nestjs/common';
import type { OutboxEvent, Prisma } from '../../generated/prisma/client';

export interface OutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  recipientIds: string[];
  payload: Prisma.InputJsonObject;
  pushTitle?: string | null;
  pushBody?: string | null;
  cacheKeys?: string[];
}

@Injectable()
export class OutboxWriter {
  async write(tx: Prisma.TransactionClient, input: OutboxEventInput): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        recipientIds: input.recipientIds,
        payload: input.payload,
        pushTitle: input.pushTitle ?? null,
        pushBody: input.pushBody ?? null,
        cacheKeys: input.cacheKeys ?? [],
      },
    });
  }

  async writeMany(tx: Prisma.TransactionClient, inputs: OutboxEventInput[]): Promise<void> {
    for (const input of inputs) await this.write(tx, input);
  }
}

export type { OutboxEvent };
