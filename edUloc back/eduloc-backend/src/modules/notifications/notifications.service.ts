import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: { userId, ...(id ? { id } : {}), isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async registerDevice(userId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform: platform as never, lastSeenAt: new Date() },
      create: { userId, token, platform: platform as never },
    });
    return { ok: true };
  }
}
