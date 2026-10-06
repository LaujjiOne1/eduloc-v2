import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { RateLimitService } from '../../common/rate-limit.service';
import { TokensService } from './tokens.service';
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, VerifyEmailDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokensService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new UnprocessableEntityException('EMAIL_TAKEN');
    const password = await argon2.hash(dto.password, { type: argon2.argon2id });
    const verifyToken = this.crypto.generateToken(32);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        password,
        phone: dto.phone ?? null,
        emailVerificationTokenHash: this.crypto.sha256(verifyToken),
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 3_600_000),
        status: 'PENDING_VERIFICATION',
      },
    });
    // L'e-mail d'activation est externe : outbox (déclenché par le relay).
    await this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'user',
        aggregateId: user.id,
        eventType: 'user.verification_requested',
        recipientIds: [user.id],
        payload: { email: user.email, token: verifyToken },
      },
    });
    return { id: user.id, status: user.status };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const hash = this.crypto.sha256(dto.token);
    const user = await this.prisma.user.findFirst({ where: { emailVerificationTokenHash: hash } });
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new UnprocessableEntityException('VERIFICATION_INVALID');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    return { ok: true };
  }

  async login(dto: LoginDto, ip: string) {
    await this.rateLimit.consume(`rl:login:${ip}:${dto.email.toLowerCase()}`, 5, 900);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.password, dto.password).catch(() => false))) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    if (user.status !== 'ACTIVE' || user.deletedAt) throw new UnauthorizedException('ACCOUNT_DISABLED');
    const refresh = await this.tokens.issueRefreshToken(user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return {
      accessToken: this.tokens.accessToken(user.id, user.isAdmin),
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.expiresAt,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      },
    };
  }

  async refresh(raw: string, userAgent?: string) {
    return this.tokens.rotate(raw, userAgent);
  }

  async logout(raw: string) {
    await this.tokens.revoke(raw);
    return { ok: true };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (user) {
      const token = this.crypto.generateToken(32);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: this.crypto.sha256(token),
          passwordResetExpiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      await this.prisma.outboxEvent.create({
        data: {
          aggregateType: 'user',
          aggregateId: user.id,
          eventType: 'user.password_reset_requested',
          recipientIds: [user.id],
          payload: { email: user.email, token },
        },
      });
    }
    return { ok: true }; // ne jamais révéler l'existence du compte
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: this.crypto.sha256(dto.token) },
    });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new UnprocessableEntityException('RESET_INVALID');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: await argon2.hash(dto.password, { type: argon2.argon2id }),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }
}
