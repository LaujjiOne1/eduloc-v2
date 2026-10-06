import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CryptoService } from '../../core/crypto/crypto.service';

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
  ) {}

  accessToken(userId: string, isAdmin: boolean): string {
    return this.jwt.sign({ sub: userId, isAdmin });
  }

  async issueRefreshToken(userId: string, userAgent?: string): Promise<{ refreshToken: string; expiresAt: Date }> {
    const raw = this.crypto.generateToken(48);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.crypto.sha256(raw),
        familyId: randomUUID(),
        userId,
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });
    return { refreshToken: raw, expiresAt };
  }

  /** Rotation : réutilisation d'un jeton révoqué → toute la famille est révoquée. */
  async rotate(raw: string, userAgent?: string): Promise<{
    userId: string; accessToken: string; refreshToken: string; expiresAt: Date;
  }> {
    const hash = this.crypto.sha256(raw);
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!token) throw new UnauthorizedException('REFRESH_INVALID');

    if (token.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: token.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('REFRESH_REUSE_DETECTED');
    }
    if (token.expiresAt < new Date()) throw new UnauthorizedException('REFRESH_EXPIRED');

    await this.prisma.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    const nextRaw = this.crypto.generateToken(48);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.crypto.sha256(nextRaw),
        familyId: token.familyId,
        userId: token.userId,
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: token.userId } });
    return {
      userId: user.id,
      accessToken: this.accessToken(user.id, user.isAdmin),
      refreshToken: nextRaw,
      expiresAt,
    };
  }

  async revoke(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.crypto.sha256(raw) },
      data: { revokedAt: new Date() },
    });
  }
}
