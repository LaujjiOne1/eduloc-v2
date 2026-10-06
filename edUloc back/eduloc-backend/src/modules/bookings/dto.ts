import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum TeachingModeDto {
  ONLINE = 'ONLINE',
  AT_HOME_BENEFICIARY = 'AT_HOME_BENEFICIARY',
  AT_HOME_TUTOR = 'AT_HOME_TUTOR',
  PUBLIC_PLACE = 'PUBLIC_PLACE',
}

export class CreateBookingDto {
  @IsUUID() offerId!: string;
  @IsUUID() beneficiaryId!: string;
  @IsISO8601({ strict: true }) startAt!: string;
  @IsEnum(TeachingModeDto) teachingMode!: TeachingModeDto;
  @IsOptional() @IsUUID() placeId?: string;
  @IsOptional() @IsUUID() voiceNoteUploadId?: string;
}

export class RefuseBookingDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class CancelBookingDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class StartSessionDto {
  @IsString() @MaxLength(6) otp!: string;
}
