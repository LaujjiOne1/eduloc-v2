import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export class VerifyEmailDto {
  @IsString() token!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
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
  @IsString() token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
