import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UpdateMeDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('USER_NOT_FOUND');
    const {
      password: _p,
      emailVerificationTokenHash: _e,
      passwordResetTokenHash: _r,
      ...safe
    } = u;
    return safe;
  }

  updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async softDelete(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: 'SUSPENDED' as never },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
