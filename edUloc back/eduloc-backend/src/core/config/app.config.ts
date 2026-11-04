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
  /** local : fichiers sur disque (développement uniquement) ; supabase : Supabase Storage. */
  STORAGE_DRIVER: z.enum(['local', 'supabase']).optional(),
  STORAGE_LOCAL_DIR: z.string().default('.storage'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_VOICE_BUCKET: z.string().default('voice-messages'),
  SUPABASE_DOCUMENTS_BUCKET: z.string().default('documents'),
  SUPABASE_TUTOR_DOCS_BUCKET: z.string().default('tutor-documents'),
  /** Justificatifs des structures partenaires (privé) et photos des salles (lecture par URL signée). */
  SUPABASE_PARTNER_DOCS_BUCKET: z.string().default('partner-documents'),
  SUPABASE_ROOM_PHOTOS_BUCKET: z.string().default('room-photos'),
  /** Photos de profil : bucket PUBLIC (URL stable, mise en cache) ; chemins non devinables (userId + UUID). */
  SUPABASE_AVATARS_BUCKET: z.string().default('avatars'),
  CENTRIFUGO_URL: z.string().url().default('http://localhost:8000'),
  /** URL WebSocket que le CLIENT utilise (par défaut dérivée de CENTRIFUGO_URL). Sur appareil réel : IP du LAN / domaine public. */
  CENTRIFUGO_PUBLIC_URL: z.string().optional(),
  CENTRIFUGO_API_KEY: z.string().min(1),
  CENTRIFUGO_TOKEN_SECRET: z.string().min(16),
  CENTRIFUGO_SUB_SECRET: z.string().min(16),
  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  EXPO_ACCESS_TOKEN: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().refine((value) => {
    const displayName = value.match(/^[^<>]+\s+<([^<>]+)>$/);
    return z.string().email().safeParse(displayName?.[1] ?? value).success;
  }, 'MAIL_FROM doit être une adresse e-mail ou un expéditeur au format Nom <email>.')
    .default('onboarding@resend.dev'),
  /** Préavis minimal entre l'envoi d'une demande et le début de la séance (spec lieux partenaires 4.5 : 12 h). */
  BOOKING_MIN_NOTICE_HOURS: z.coerce.number().default(24),
  /** Pas de démarrage des créneaux proposés (minutes) et marges entre séances : valeurs à confirmer (spec 4.4). */
  BOOKING_SLOT_STEP_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  /**
   * Durée pendant laquelle une demande reste valable (minutes) : le Demandeur la choisit, libre mais bornée (D-03 ; valeurs
   * à confirmer avec le responsable produit). Passé ce délai sans réponse du Tuteur, la demande expire.
   */
  BOOKING_REQUEST_VALIDITY_MIN_MINUTES: z.coerce.number().int().min(5).default(60),
  BOOKING_REQUEST_VALIDITY_MAX_MINUTES: z.coerce.number().int().min(5).default(4320),
  BOOKING_REQUEST_VALIDITY_DEFAULT_MINUTES: z.coerce.number().int().min(5).default(1440),
  BOOKING_BUFFER_MINUTES: z.coerce.number().int().min(0).max(240).default(15),
  BOOKING_TRAVEL_BUFFER_MINUTES: z.coerce.number().int().min(0).max(480).default(30),
  ROOM_TURNOVER_BUFFER_MINUTES: z.coerce.number().int().min(0).max(240).default(0),
  /** Frais de service EduLoc : taux global sur le tarif du Tuteur (MVP : 10 %). */
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.1),
  /**
   * Service de paiement externe (eduloc-pay-subscriptions). Désactivé par défaut : tant que son API n'est pas prête,
   * l'émission de tickets répond « paiement indisponible » et rien d'autre dans l'application ne change.
   */
  PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false'),
  /** Adresse PUBLIQUE de la page de paiement (ouverte dans l'application). HTTPS obligatoire en production (SEC-01). */
  PAY_PUBLIC_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  /** Adresse de l'API du service de paiement, jointe de serveur à serveur (vérification du statut, MM-03). Facultative. */
  PAY_API_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  /** Clé que le backend présente au service de paiement. Jamais exposée au client (SEC-02). */
  PAY_API_KEY: z.string().optional().default(''),
  /** Secret de signature des tickets émis vers le service de paiement (HS256). */
  PAY_TICKET_SECRET: z.string().optional().default(''),
  /** Secret de signature des notifications reçues du service de paiement (HMAC-SHA256, SEC-05). */
  PAY_WEBHOOK_SECRET: z.string().optional().default(''),
  PAY_TICKET_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(20),
  /**
   * Connexion sociale : chaque fournisseur est actif dès qu'il est configuré, sinon /auth/oauth/exchange le refuse pour lui.
   * Les jetons sont vérifiés par le backend lui-même (clés publiques de Google / Apple, API Graph de Facebook).
   */
  /** Identifiants client OAuth acceptés comme destinataire (aud) du jeton Google : web, Android et iOS, séparés par des virgules. */
  GOOGLE_CLIENT_IDS: z.string().default(''),
  /** Identifiants acceptés pour Apple : bundle id de l'app (et/ou Services ID), séparés par des virgules. */
  APPLE_CLIENT_IDS: z.string().default(''),
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),
  /** Durée du blocage temporaire du créneau (Tuteur + salle) pendant la finalisation d'une réservation. */
  BOOKING_HOLD_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  /** Plafond du tarif horaire d'une salle : jamais plus chère que le plus haut forfait de déplacement (Ar). */
  ROOM_MAX_HOURLY_FEE: z.coerce.number().min(0).default(10_000),
  CANCELLATION_FREE_NOTICE_HOURS: z.coerce.number().default(24),
  MEDIA_RETENTION_MONTHS: z.coerce.number().default(12),
  /** Ollama (embeddings du matching) : joignable uniquement depuis le réseau privé, jamais publié sur Internet. */
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  EMBEDDING_MODEL: z.string().min(1).default('hf.co/unsloth/embeddinggemma-2-GGUF:UD-Q4_K_XL'),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(768),
  /** Import de CV : OCR PaddleOCR (service docker/paddleocr) — absent, l'OCR retombe sur Tesseract. */
  PADDLEOCR_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  /** Modèle Ollama d'extraction structurée du CV (génération, distinct du modèle d'embeddings). */
  CV_EXTRACTION_MODEL: z.string().min(1).default('qwen2.5:3b'),
  CV_EXTRACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
  /** Poids du scoring du matching (spec §6.4) : valeurs initiales, à calibrer avec le jeu d'évaluation. */
  MATCHING_CORROBORATION_WEIGHT: z.coerce.number().min(0).default(0.02),
  MATCHING_CORROBORATION_WINDOW: z.coerce.number().min(0).default(0.1),
  MATCHING_SUBJECT_BONUS: z.coerce.number().min(0).default(0.03),
  MATCHING_RATING_BONUS: z.coerce.number().min(0).default(0.02),
  MATCHING_RATING_PRIOR_MEAN: z.coerce.number().min(0).max(5).default(3.5),
  MATCHING_RATING_PRIOR_WEIGHT: z.coerce.number().min(0).default(5),
  MATCHING_RELEVANCE_WINDOW: z.coerce.number().min(0).default(0.15),
  /** Plancher ABSOLU de similarité (meilleure source d'un tuteur), appliqué en SQL. Propre au modèle d'embedding : à recalibrer s'il change (eval/report.md). */
  /** Classement final (somme = 1 si la proximité est connue) : pédagogie 0,60 / disponibilité 0,20 / proximité 0,10 / qualité 0,10. */
  MATCHING_WEIGHT_PEDAGOGY: z.coerce.number().min(0).max(1).default(0.6),
  MATCHING_WEIGHT_AVAILABILITY: z.coerce.number().min(0).max(1).default(0.2),
  MATCHING_WEIGHT_PROXIMITY: z.coerce.number().min(0).max(1).default(0.1),
  MATCHING_WEIGHT_QUALITY: z.coerce.number().min(0).max(1).default(0.1),
  MATCHING_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.65),
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
  readonly storageDriver: 'local' | 'supabase';
  readonly storageLocalDir: string;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly voiceBucket: string;
  readonly documentsBucket: string;
  readonly tutorDocsBucket: string;
  readonly partnerDocsBucket: string;
  readonly roomPhotosBucket: string;
  readonly avatarsBucket: string;
  readonly centrifugoUrl: string;
  readonly centrifugoPublicUrl: string;
  readonly centrifugoApiKey: string;
  readonly centrifugoTokenSecret: string;
  readonly centrifugoSubSecret: string;
  readonly livekitUrl: string;
  readonly livekitApiKey: string;
  readonly livekitApiSecret: string;
  readonly fcmServiceAccountJson: string;
  readonly expoAccessToken: string;
  readonly resendApiKey: string;
  readonly mailFrom: string;
  readonly bookingMinNoticeHours: number;
  readonly bookingSlotStepMinutes: number;
  readonly bookingRequestValidityMinMinutes: number;
  readonly bookingRequestValidityMaxMinutes: number;
  readonly bookingRequestValidityDefaultMinutes: number;
  readonly bookingBufferMinutes: number;
  readonly bookingTravelBufferMinutes: number;
  readonly roomTurnoverBufferMinutes: number;
  readonly cancellationFreeNoticeHours: number;
  readonly mediaRetentionMonths: number;
  readonly ollamaUrl: string;
  readonly embeddingModel: string;
  readonly embeddingDim: number;
  readonly paddleOcrUrl: string | null;
  readonly cvExtractionModel: string;
  readonly cvExtractionTimeoutMs: number;
  readonly matchingMinSimilarity: number;
  readonly matchingFinalWeights: { pedagogy: number; availability: number; proximity: number; quality: number };
  readonly platformCommissionRate: number;
  readonly bookingHoldMinutes: number;
  readonly payments: {
    enabled: boolean;
    publicUrl: string | null;
    apiUrl: string | null;
    apiKey: string;
    ticketSecret: string;
    webhookSecret: string;
    ticketTtlMinutes: number;
  };
  readonly oauth: {
    googleClientIds: string[];
    appleClientIds: string[];
    facebook: { appId: string; appSecret: string } | null;
  };
  readonly roomMaxHourlyFee: number;
  readonly matchingScoring: {
    corroborationWeight: number; corroborationWindow: number; subjectBonus: number; ratingBonus: number;
    ratingPriorMean: number; ratingPriorWeight: number; relevanceWindow: number;
  };

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
    // Sans projet Supabase réel (placeholder de .env.example), le développement bascule sur le disque local.
    const supabaseIsPlaceholder = /votre-projet/i.test(parsed.SUPABASE_URL)
      || parsed.SUPABASE_SERVICE_ROLE_KEY === 'service-role-key';
    this.storageDriver = parsed.STORAGE_DRIVER ?? (supabaseIsPlaceholder ? 'local' : 'supabase');
    if (this.storageDriver === 'local' && parsed.NODE_ENV === 'production') {
      throw new Error('STORAGE_DRIVER=local est interdit en production.');
    }
    this.storageLocalDir = parsed.STORAGE_LOCAL_DIR;
    this.supabaseUrl = parsed.SUPABASE_URL;
    this.supabaseServiceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY;
    this.voiceBucket = parsed.SUPABASE_VOICE_BUCKET;
    this.documentsBucket = parsed.SUPABASE_DOCUMENTS_BUCKET;
    this.tutorDocsBucket = parsed.SUPABASE_TUTOR_DOCS_BUCKET;
    this.partnerDocsBucket = parsed.SUPABASE_PARTNER_DOCS_BUCKET;
    this.roomPhotosBucket = parsed.SUPABASE_ROOM_PHOTOS_BUCKET;
    this.avatarsBucket = parsed.SUPABASE_AVATARS_BUCKET;
    this.centrifugoUrl = parsed.CENTRIFUGO_URL;
    this.centrifugoPublicUrl = parsed.CENTRIFUGO_PUBLIC_URL
      ?? `${parsed.CENTRIFUGO_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/connection/websocket`;
    this.centrifugoApiKey = parsed.CENTRIFUGO_API_KEY;
    this.centrifugoTokenSecret = parsed.CENTRIFUGO_TOKEN_SECRET;
    this.centrifugoSubSecret = parsed.CENTRIFUGO_SUB_SECRET;
    this.livekitUrl = parsed.LIVEKIT_URL;
    this.livekitApiKey = parsed.LIVEKIT_API_KEY;
    this.livekitApiSecret = parsed.LIVEKIT_API_SECRET;
    this.fcmServiceAccountJson = parsed.FCM_SERVICE_ACCOUNT_JSON;
    this.expoAccessToken = parsed.EXPO_ACCESS_TOKEN;
    this.resendApiKey = parsed.RESEND_API_KEY;
    this.mailFrom = parsed.MAIL_FROM;
    this.bookingMinNoticeHours = parsed.BOOKING_MIN_NOTICE_HOURS;
    this.bookingSlotStepMinutes = parsed.BOOKING_SLOT_STEP_MINUTES;
    this.bookingRequestValidityMinMinutes = parsed.BOOKING_REQUEST_VALIDITY_MIN_MINUTES;
    this.bookingRequestValidityMaxMinutes = parsed.BOOKING_REQUEST_VALIDITY_MAX_MINUTES;
    this.bookingRequestValidityDefaultMinutes = parsed.BOOKING_REQUEST_VALIDITY_DEFAULT_MINUTES;
    this.bookingBufferMinutes = parsed.BOOKING_BUFFER_MINUTES;
    this.bookingTravelBufferMinutes = parsed.BOOKING_TRAVEL_BUFFER_MINUTES;
    this.roomTurnoverBufferMinutes = parsed.ROOM_TURNOVER_BUFFER_MINUTES;
    this.cancellationFreeNoticeHours = parsed.CANCELLATION_FREE_NOTICE_HOURS;
    this.mediaRetentionMonths = parsed.MEDIA_RETENTION_MONTHS;
    this.ollamaUrl = parsed.OLLAMA_URL.replace(/\/$/, '');
    this.embeddingModel = parsed.EMBEDDING_MODEL;
    this.embeddingDim = parsed.EMBEDDING_DIM;
    this.paddleOcrUrl = parsed.PADDLEOCR_URL ? parsed.PADDLEOCR_URL.replace(/\/$/, '') : null;
    this.cvExtractionModel = parsed.CV_EXTRACTION_MODEL;
    this.cvExtractionTimeoutMs = parsed.CV_EXTRACTION_TIMEOUT_MS;
    this.matchingMinSimilarity = parsed.MATCHING_MIN_SIMILARITY;
    this.matchingFinalWeights = {
      pedagogy: parsed.MATCHING_WEIGHT_PEDAGOGY, availability: parsed.MATCHING_WEIGHT_AVAILABILITY,
      proximity: parsed.MATCHING_WEIGHT_PROXIMITY, quality: parsed.MATCHING_WEIGHT_QUALITY,
    };
    this.platformCommissionRate = parsed.PLATFORM_COMMISSION_RATE;
    this.bookingHoldMinutes = parsed.BOOKING_HOLD_MINUTES;
    const paymentsEnabled = parsed.PAYMENTS_ENABLED === 'true';
    if (paymentsEnabled) {
      // Un paiement activé à moitié est pire qu'un paiement désactivé : on refuse de démarrer.
      if (!parsed.PAY_PUBLIC_URL) throw new Error('PAYMENTS_ENABLED=true exige PAY_PUBLIC_URL.');
      if (parsed.PAY_TICKET_SECRET.length < 32) throw new Error('PAY_TICKET_SECRET >= 32 caractères requis (PAYMENTS_ENABLED=true).');
      if (parsed.PAY_WEBHOOK_SECRET.length < 32) throw new Error('PAY_WEBHOOK_SECRET >= 32 caractères requis (PAYMENTS_ENABLED=true).');
      if (parsed.PAY_TICKET_SECRET === parsed.PAY_WEBHOOK_SECRET) throw new Error('PAY_TICKET_SECRET et PAY_WEBHOOK_SECRET doivent différer.');
      if (parsed.NODE_ENV === 'production' && !parsed.PAY_PUBLIC_URL.startsWith('https://')) {
        throw new Error('PAY_PUBLIC_URL doit être en HTTPS en production (SEC-01).');
      }
    }
    this.payments = {
      enabled: paymentsEnabled,
      publicUrl: parsed.PAY_PUBLIC_URL ? parsed.PAY_PUBLIC_URL.replace(/\/$/, '') : null,
      apiUrl: parsed.PAY_API_URL ? parsed.PAY_API_URL.replace(/\/$/, '') : null,
      apiKey: parsed.PAY_API_KEY,
      ticketSecret: parsed.PAY_TICKET_SECRET,
      webhookSecret: parsed.PAY_WEBHOOK_SECRET,
      ticketTtlMinutes: parsed.PAY_TICKET_TTL_MINUTES,
    };
    if (!!parsed.FACEBOOK_APP_ID !== !!parsed.FACEBOOK_APP_SECRET) {
      throw new Error('FACEBOOK_APP_ID et FACEBOOK_APP_SECRET vont ensemble : définissez les deux ou aucun.');
    }
    const list = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);
    this.oauth = {
      googleClientIds: list(parsed.GOOGLE_CLIENT_IDS),
      appleClientIds: list(parsed.APPLE_CLIENT_IDS),
      facebook: parsed.FACEBOOK_APP_ID ? { appId: parsed.FACEBOOK_APP_ID, appSecret: parsed.FACEBOOK_APP_SECRET } : null,
    };
    this.roomMaxHourlyFee = parsed.ROOM_MAX_HOURLY_FEE;
    this.matchingScoring = {
      corroborationWeight: parsed.MATCHING_CORROBORATION_WEIGHT,
      corroborationWindow: parsed.MATCHING_CORROBORATION_WINDOW,
      subjectBonus: parsed.MATCHING_SUBJECT_BONUS,
      ratingBonus: parsed.MATCHING_RATING_BONUS,
      ratingPriorMean: parsed.MATCHING_RATING_PRIOR_MEAN,
      ratingPriorWeight: parsed.MATCHING_RATING_PRIOR_WEIGHT,
      relevanceWindow: parsed.MATCHING_RELEVANCE_WINDOW,
    };
  }
}
