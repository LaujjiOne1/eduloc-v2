import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth/oauth.service';
import {
  LoginDto, LogoutDto, OAuthExchangeDto, RefreshDto, RegisterDto,
  RequestPasswordResetDto, ResendVerificationDto, ResetPasswordDto, VerifyEmailDto,
} from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly oauth: OAuthService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Public()
  @Post('verify-email')
  verify(@Body() dto: VerifyEmailDto) {
    return this.service.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.service.resendVerification(dto);
  }

  /**
   * Connexion / inscription par Google, Apple ou Facebook. Même réponse que /auth/login (+ `created` : compte créé à
   * l'instant). Erreurs : 401 OAUTH_TOKEN_INVALID, 503 OAUTH_PROVIDER_DISABLED, 422 OAUTH_EMAIL_REQUIRED /
   * OAUTH_EMAIL_UNVERIFIED, 403 OAUTH_LINK_FORBIDDEN / ACCOUNT_DISABLED.
   */
  @Public()
  @Post('oauth/exchange')
  @HttpCode(200)
  oauthExchange(@Body() dto: OAuthExchangeDto, @Ip() ip: string) {
    return this.oauth.exchange(dto, ip);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.service.login(dto, ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') ua?: string) {
    return this.service.refresh(dto.refreshToken, ua);
  }

  // Public : l'application révoque aussi le jeton d'un compte « gardé » sur l'appareil alors qu'aucune session n'est
  // ouverte. Posséder le jeton de rafraîchissement (secret, 48 octets aléatoires) suffit comme preuve pour le révoquer.
  @Public()
  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.service.logout(dto.refreshToken);
  }

  @Public()
  @Post('password/request')
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.service.requestPasswordReset(dto);
  }

  @Public()
  @Post('password/reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto);
  }
}
