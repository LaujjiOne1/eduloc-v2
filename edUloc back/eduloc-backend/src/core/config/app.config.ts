import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL requis'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().min(1, 'REDIS_URL requis').default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET >= 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  OTP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'OTP_ENCRYPTION_KEY = 32 octets hex'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_VOICE_BUCKET: z.string().default('voice-messages'),
  SUPABASE_DOCUMENTS_BUCKET: z.string().default('documents'),
  SUPABASE_TUTOR_DOCS_BUCKET: z.string().default('tutor-documents'),
  CENTRIFUGO_URL: z.string().url().default('http://localhost:8000'),
  CENTRIFUGO_API_KEY: z.string().min(1),
  CENTRIFUGO_TOKEN_SECRET: z.string().min(16),
  CENTRIFUGO_SUB_SECRET: z.string().min(16),
  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  BOOKING_MIN_NOTICE_HOURS: z.coerce.number().default(2),
  CANCELLATION_FREE_NOTICE_HOURS: z.coerce.number().default(24),
  MEDIA_RETENTION_MONTHS: z.coerce.number().default(12),
});

@Injectable()
export class AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly apiUrl: string;
  readonly corsOrigins: string[];
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly otpEncryptionKey: Buffer;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly voiceBucket: string;
  readonly documentsBucket: string;
  readonly tutorDocsBucket: string;
  readonly centrifugoUrl: string;
  readonly centrifugoApiKey: string;
  readonly centrifugoTokenSecret: string;
  readonly centrifugoSubSecret: string;
  readonly livekitUrl: string;
  readonly livekitApiKey: string;
  readonly livekitApiSecret: string;
  readonly fcmServiceAccountJson: string;
  readonly bookingMinNoticeHours: number;
  readonly cancellationFreeNoticeHours: number;
  readonly mediaRetentionMonths: number;

  constructor() {
    const parsed = envSchema.parse(process.env);
    this.nodeEnv = parsed.NODE_ENV;
    this.port = parsed.PORT;
    this.apiUrl = parsed.API_URL;
    this.corsOrigins = parsed.CORS_ORIGINS.split(',').map((o) => o.trim());
    this.databaseUrl = parsed.DATABASE_URL;
    this.redisUrl = parsed.REDIS_URL;
    this.jwtSecret = parsed.JWT_SECRET;
    this.jwtExpiresIn = parsed.JWT_EXPIRES_IN;
    this.otpEncryptionKey = Buffer.from(parsed.OTP_ENCRYPTION_KEY, 'hex');
    this.supabaseUrl = parsed.SUPABASE_URL;
    this.supabaseServiceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY;
    this.voiceBucket = parsed.SUPABASE_VOICE_BUCKET;
    this.documentsBucket = parsed.SUPABASE_DOCUMENTS_BUCKET;
    this.tutorDocsBucket = parsed.SUPABASE_TUTOR_DOCS_BUCKET;
    this.centrifugoUrl = parsed.CENTRIFUGO_URL;
    this.centrifugoApiKey = parsed.CENTRIFUGO_API_KEY;
    this.centrifugoTokenSecret = parsed.CENTRIFUGO_TOKEN_SECRET;
    this.centrifugoSubSecret = parsed.CENTRIFUGO_SUB_SECRET;
    this.livekitUrl = parsed.LIVEKIT_URL;
    this.livekitApiKey = parsed.LIVEKIT_API_KEY;
    this.livekitApiSecret = parsed.LIVEKIT_API_SECRET;
    this.fcmServiceAccountJson = parsed.FCM_SERVICE_ACCOUNT_JSON;
    this.bookingMinNoticeHours = parsed.BOOKING_MIN_NOTICE_HOURS;
    this.cancellationFreeNoticeHours = parsed.CANCELLATION_FREE_NOTICE_HOURS;
    this.mediaRetentionMonths = parsed.MEDIA_RETENTION_MONTHS;
  }
}
