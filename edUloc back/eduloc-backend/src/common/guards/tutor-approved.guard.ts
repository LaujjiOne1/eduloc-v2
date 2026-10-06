import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

export interface ApprovedTutorProfile {
  id: string;
  userId: string;
  isVisible: boolean;
  suspendedAt: Date | null;
}

declare module 'express' {
  interface Request {
    tutorProfile?: ApprovedTutorProfile;
  }
}

@Injectable()
export class TutorApprovedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser; tutorProfile?: ApprovedTutorProfile }>();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('AUTH_REQUIRED');
    const profile = await this.prisma.tutorProfile.findUnique({ where: { userId } });
    if (!profile || !profile.isVisible || profile.suspendedAt) {
      throw new ForbiddenException('TUTOR_NOT_APPROVED');
    }
    req.tutorProfile = profile;
    return true;
  }
}
