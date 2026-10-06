import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { decodeCursor, encodeCursor, CursorPage, CursorQueryDto } from '../../common/pagination/cursor-pagination';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async requireParticipant(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ requesterId: userId }, { tutorProfile: { userId } }],
      },
      include: { tutorProfile: true },
    });
    if (!conv) throw new NotFoundException('CONVERSATION_NOT_FOUND');
    const isRequester = conv.requesterId === userId;
    return { conv, isRequester };
  }

  async listMine(userId: string, q: CursorQueryDto): Promise<CursorPage<unknown>> {
    const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ requesterId: userId }, { tutorProfile: { userId } }] },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor.id },
            skip: 1,
          }
        : {}),
    });
    const items = rows.slice(0, q.limit);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > q.limit && last
        ? encodeCursor(last.lastMessageAt ?? last.createdAt, last.id)
        : null,
    };
  }

  async listMessages(userId: string, conversationId: string, q: CursorQueryDto) {
    await this.requireParticipant(userId, conversationId);
    const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
    const rows = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      include: { attachment: true },
      ...(cursor
        ? {
            cursor: { id: cursor.id },
            skip: 1,
          }
        : {}),
    });
    const items = rows.slice(0, q.limit).reverse();
    const last = rows[q.limit - 1];
    return {
      items,
      nextCursor: rows.length > q.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async markRead(userId: string, conversationId: string) {
    const { isRequester } = await this.requireParticipant(userId, conversationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isRequester
        ? { requesterLastReadAt: new Date() }
        : { tutorLastReadAt: new Date() },
    });
    return { ok: true };
  }
}
