import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export const VOICE_MIME = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'] as const;
export const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

export class RequestUploadDto {
  @IsIn(['VOICE', 'DOCUMENT']) kind!: 'VOICE' | 'DOCUMENT';
  @IsString() @MaxLength(100) mimeType!: string;
  @IsInt() @Min(1) @Max(20 * 1024 * 1024) sizeBytes!: number;
  @ValidateIf((o: RequestUploadDto) => o.kind === 'VOICE')
  @IsInt() @Min(500) @Max(300_000) durationMs?: number;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
}

export class SendMessageDto {
  @IsUUID() clientMessageId!: string;
  @IsIn(['VOICE', 'DOCUMENT']) type!: 'VOICE' | 'DOCUMENT';
  @IsUUID() uploadId!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(128)
  @IsNumber({}, { each: true }) @Min(0, { each: true }) @Max(1, { each: true })
  waveform?: number[];
  @IsOptional() @IsUUID() replyToId?: string;
}

export class CreateCallDto {
  @IsUUID() conversationId!: string;
  @IsIn(['AUDIO', 'VIDEO']) type!: 'AUDIO' | 'VIDEO';
}
