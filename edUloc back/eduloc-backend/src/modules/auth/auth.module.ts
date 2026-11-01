import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityResolver } from './oauth/identity-resolver';
import { OAuthService } from './oauth/oauth.service';
import { TokensService } from './tokens.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokensService, RateLimitService, IdentityResolver, OAuthService],
})
export class AuthModule {}
