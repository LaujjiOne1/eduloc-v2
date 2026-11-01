import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export const LESSON_ALARM_LEADS = [10, 15, 30, 60] as const;

export class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  // La photo de profil ne se règle plus ici (URL libre = n'importe quelle adresse affichée aux autres) : voir POST /users/me/avatar.
  /** Alarme de cours : activée ou non, et combien de minutes avant la séance. */
  @IsOptional() @IsBoolean() lessonAlarmEnabled?: boolean;
  @IsOptional() @IsIn(LESSON_ALARM_LEADS as unknown as number[]) lessonAlarmLeadMinutes?: number;
}

export class AvatarUploadRequestDto {
  @IsString() @MaxLength(100) mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
}

export class RegisterAvatarDto {
  @IsUUID() uploadId!: string;
}
