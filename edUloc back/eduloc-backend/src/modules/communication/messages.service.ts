import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { AppConfig } from '../../core/config/app.config';
import { RateLimitService } from '../../common/rate-limit.service';
import { OutboxWriter } from '../../infrastructure/outbox/outbox-writer';
import {
  STORAGE_PROVIDER, StorageProvider, documentPath, extFromMime, voiceMessagePath,
} from '../../infrastructure/storage/storage-provider.port';
import { CacheKeys, CacheService } from '../../infrastructure/cache/cache.service';
import { CommunicationPolicy } from './domain/communication-policy';
import { ConversationsService } from './conversations.service';
import { DOC_MIME, RequestUploadDto, SendMessageDto, VOICE_MIME } from './dto';

interface UploadMeta {
  conversationId: string;
  senderId: string;
  kind: 'VOICE' | 'DOCUMENT';
  storagePath: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  fileName?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cfg: AppConfig,
    private readonly rateLimit: RateLimitService,
    private readonly outbox: OutboxWriter,
    private readonly conversations: ConversationsService,
    private readonly cache: CacheService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Étape 1 : URL d'upload signée — le fichier ne traversera jamais NestJS. */
  async requestUpload(userId: string, conversationId: string, dto: RequestUploadDto) {
    await this.rateLimit.consume(`rl:upload:${userId}`, 30, 600);
    const { conv, isRequester } = await this.conversations.requireParticipant(userId, conversationId);
    await this.assertCanSend(
      userId, conv.id, conv.tutorProfileId,
      conv.tutorProfile.suspendedAt !== null, isRequester, dto.kind === 'VOICE',
    );

    const allowed = dto.kind === 'VOICE' ? VOICE_MIME : DOC_MIME;
    if (!(allowed as readonly string[]).includes(dto.mimeType)) {
      throw new UnprocessableEntityException('MIME_TYPE_NOT_ALLOWED');
    }
    const bucket = dto.kind === 'VOICE' ? this.cfg.voiceBucket : this.cfg.documentsBucket;
    const messageId = randomUUID();
    const storagePath = dto.kind === 'VOICE'
      ? voiceMessagePath(conversationId, messageId, extFromMime(dto.mimeType))
      : documentPath(conversationId, messageId, extFromMime(dto.mimeType));

    const { signedUrl, token } = await this.storage.createSignedUploadUrl(bucket, storagePath);
    const uploadId = randomUUID();
    const meta: UploadMeta = {
      conversationId, senderId: userId, kind: dto.kind, storagePath, bucket,
      mimeType: dto.mimeType, sizeBytes: dto.sizeBytes, durationMs: dto.durationMs, fileName: dto.fileName,
    };
    await this.redis.set(CacheKeys.upload(uploadId), JSON.stringify(meta), 900); // 15 min
    return { uploadId, signedUrl, token, messageId };
  }

  /** Étape 2 : envoi — métadonnées Redis consommées (GETDEL), objet vérifié. */
  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const raw = await this.redis.getDel(CacheKeys.upload(dto.uploadId));
    if (!raw) throw new UnprocessableEntityException('UPLOAD_EXPIRED');
    const meta = JSON.parse(raw) as UploadMeta;
    if (meta.conversationId !== conversationId || meta.senderId !== userId) {
      throw new UnprocessableEntityException('UPLOAD_MISMATCH');
    }
    const info = await this.storage.getObjectInfo(meta.bucket, meta.storagePath);
    if (!info.exists) throw new UnprocessableEntityException('UPLOAD_NOT_FOUND');
    if (info.sizeBytes > 20 * 1024 * 1024) throw new UnprocessableEntityException('FILE_TOO_LARGE');

    const { conv, isRequester } = await this.conversations.requireParticipant(userId, conversationId);
    await this.assertCanSend(
      userId, conversationId, conv.tutorProfileId,
      conv.tutorProfile.suspendedAt !== null, isRequester, dto.type === 'VOICE',
    );

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existing = await tx.message.findUnique({
          where: {
            conversationId_clientMessageId: {
              conversationId,
              clientMessageId: dto.clientMessageId,
            },
          },
        });
        if (existing) return this.toMessageResponse(existing);

        const message = await tx.message.create({
          data: {
            conversationId,
            senderId: userId,
            type: dto.type as never,
            clientMessageId: dto.clientMessageId,
            replyToId: dto.replyToId ?? null,
            attachment: {
              create: {
                kind: meta.kind as never,
                bucket: meta.bucket,
                storagePath: meta.storagePath,
                mimeType: meta.mimeType,
                sizeBytes: info.sizeBytes,
                fileName: meta.fileName ?? null,
                durationMs: meta.durationMs ?? null,
                waveform: dto.waveform ?? undefined,
              },
            },
          },
          include: { attachment: true },
        });
        const preview = dto.type === 'VOICE'
          ? `Message vocal · ${Math.round((meta.durationMs ?? 0) / 1000)}s`
          : `Document · ${meta.fileName ?? 'fichier'}`;
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageType: dto.type as never,
            lastMessagePreview: preview,
            lastMessageAt: new Date(),
            bookingId: conv.bookingId,
          },
        });
        const recipientId = isRequester ? conv.tutorProfile.userId : conv.requesterId;
        await this.outbox.write(tx, {
          aggregateType: 'message',
          aggregateId: message.id,
          eventType: dto.type === 'VOICE' ? 'message.voice.created' : 'message.document.created',
          recipientIds: [recipientId],
          payload: { messageId: message.id, conversationId, preview },
          pushTitle: dto.type === 'VOICE' ? 'Nouveau message vocal' : 'Nouveau document',
          pushBody: preview,
        });
        return this.toMessageResponse(message);
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const existing = await this.prisma.message.findUnique({
          where: {
            conversationId_clientMessageId: {
              conversationId,
              clientMessageId: dto.clientMessageId,
            },
          },
        });
        if (existing) return this.toMessageResponse(existing);
      }
      throw err;
    }
  }

  async attachmentUrl(userId: string, attachmentId: string) {
    const att = await this.prisma.messageAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          deletedAt: null,
          conversation: { OR: [{ requesterId: userId }, { tutorProfile: { userId } }] },
        },
      },
    });
    if (!att) throw new UnprocessableEntityException('ATTACHMENT_NOT_FOUND');
    return this.cache.wrap(`signed:${att.id}`, 3000, () =>
      this.storage.createSignedReadUrl(att.bucket, att.storagePath, 3600),
    );
  }

  async markListened(userId: string, messageId: string) {
    const msg = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: { not: userId },
        conversation: { OR: [{ requesterId: userId }, { tutorProfile: { userId } }] },
      },
    });
    if (!msg) throw new UnprocessableEntityException('MESSAGE_NOT_FOUND');
    if (msg.listenedAt) return { ok: true };
    const updated = await this.prisma.message.updateMany({
      where: { id: messageId, listenedAt: null },
      data: { listenedAt: new Date() },
    });
    if (updated.count === 1 && msg.senderId) {
      await this.prisma.$transaction(async (tx) => {
        await this.outbox.write(tx, {
          aggregateType: 'message',
          aggregateId: messageId,
          eventType: 'message.listened',
          recipientIds: [msg.senderId!],
          payload: { messageId },
        });
      });
    }
    return { ok: true };
  }

  private async assertCanSend(
    userId: string,
    conversationId: string,
    tutorProfileId: string,
    tutorSuspended: boolean,
    isRequester: boolean,
    isVoice: boolean,
  ) {
    const [hasPending, hasActive, lastCompleted, requesterVoices, tutorMsgs] = await Promise.all([
      this.prisma.booking.findFirst({
        where: { conversations: { some: { id: conversationId } }, status: 'PENDING' },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: { conversations: { some: { id: conversationId } }, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: { conversations: { some: { id: conversationId } }, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
      isVoice && isRequester
        ? this.prisma.message.count({ where: { conversationId, senderId: userId, type: 'VOICE' } })
        : Promise.resolve(0),
      this.prisma.message.count({
        where: {
          conversationId,
          type: { in: ['VOICE', 'DOCUMENT'] },
          sender: { tutorProfile: { id: tutorProfileId } },
        },
      }),
    ]);
    const relation = CommunicationPolicy.relation(
      {
        hasPending: !!hasPending,
        hasConfirmedOrInProgress: !!hasActive,
        lastCompletedAt: lastCompleted?.completedAt ?? null,
        tutorSuspended,
      },
      new Date(),
    );
    const ok = isVoice
      ? CommunicationPolicy.canSendVoice(relation, isRequester, requesterVoices, tutorMsgs > 0)
      : CommunicationPolicy.canSend(relation);
    if (!ok) throw new UnprocessableEntityException('COMMUNICATION_NOT_ALLOWED');
  }

  private toMessageResponse(m: { id: string; type: string; createdAt: Date; listenedAt: Date | null }) {
    return { id: m.id, type: m.type, createdAt: m.createdAt, listenedAt: m.listenedAt };
  }

  /** Rétention 12 mois après la fin de séance (décision attachment n°3). */
  async cleanupExpiredMedia(): Promise<number> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - this.cfg.mediaRetentionMonths);
    const attachments = await this.prisma.messageAttachment.findMany({
      where: {
        createdAt: { lt: cutoff },
        message: {
          conversation: { booking: { is: { status: 'COMPLETED', completedAt: { lt: cutoff } } } },
        },
      },
      take: 200,
    });
    for (const att of attachments) {
      await this.storage.deleteObject(att.bucket, att.storagePath);
      await this.prisma.message.update({
        where: { id: att.messageId },
        data: { deletedAt: new Date() },
      });
      await this.prisma.messageAttachment.delete({ where: { id: att.id } }).catch(() => undefined);
    }
    return attachments.length;
  }
}
