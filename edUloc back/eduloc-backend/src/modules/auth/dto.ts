import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SIX_DIGITS = /^\d{6}$/;

export class RegisterDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

/** Code à 6 chiffres reçu par e-mail. */
export class VerifyEmailDto {
  @IsEmail() email!: string;
  @Matches(SIX_DIGITS, { message: 'code doit contenir 6 chiffres' }) code!: string;
}

export class ResendVerificationDto {
  @IsEmail() email!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

/** Connexion sociale : le jeton que l'application a obtenu auprès de Google, d'Apple ou de Facebook. */
export class OAuthExchangeDto {
  @IsIn(['google', 'apple', 'facebook']) provider!: 'google' | 'apple' | 'facebook';
  /** Jeton d'identité (Google, Apple) ou jeton d'accès (Facebook). */
  @IsString() @MinLength(10) @MaxLength(4096) token!: string;
  /** Valeur brute envoyée au fournisseur pour lier le jeton à cette tentative (facultatif, recommandé). */
  @IsOptional() @IsString() @MaxLength(256) nonce?: string;
  /** Apple ne renvoie le nom qu'à la première autorisation : l'application le transmet ici (utilisé seulement à la création). */
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
}

export class RefreshDto {
  @IsString() refreshToken!: string;
}

export class LogoutDto {
  @IsString() refreshToken!: string;
}

export class RequestPasswordResetDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsEmail() email!: string;
  @Matches(SIX_DIGITS, { message: 'code doit contenir 6 chiffres' }) code!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
