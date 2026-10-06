import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user?.isAdmin) throw new ForbiddenException('ADMIN_REQUIRED');
    return true;
  }
}
