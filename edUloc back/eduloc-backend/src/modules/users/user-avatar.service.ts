import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../core/config/app.config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { CacheKeys } from '../../infrastructure/cache/cache.service';
import { STORAGE_PROVIDER, StorageProvider, extFromMime } from '../../infrastructure/storage/storage-provider.port';
import { UnprocessableError } from '../../common/errors/domain-errors';

export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AVATAR_LIMIT_BYTES = 5 * 1024 * 1024;
const TICKET_TTL_SECONDS = 900;

interface AvatarUploadMetadata {
  userId: string;
  scope: 'AVATAR';
  bucket: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Photo de profil : la même pour tous les types de compte (demandeur, tuteur, gestionnaire de lieu).
 * Envoi en deux temps comme les autres fichiers (URL signée → PUT direct → enregistrement), mais dans un bucket PUBLIC :
 * l'URL enregistrée est stable, donc utilisable telle quelle dans les listes (résultats, conversations, rendez-vous).
 * Pour un tuteur, `TutorProfile.profilePhoto` (la photo publique de sa fiche) suit celle du compte.
 */
@Injectable()
export class UserAvatarService {
  constructor(
    private readonly cfg: AppConfig,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async createTicket(userId: string, input: { mimeType: string; sizeBytes: number }) {
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(input.mimeType)) throw new UnprocessableError('MIME_TYPE_NOT_ALLOWED');
    if (input.sizeBytes > AVATAR_LIMIT_BYTES) throw new UnprocessableError('FILE_TOO_LARGE');
    const bucket = this.cfg.avatarsBucket;
    // Chemin non devinable : l'URL publique ne se déduit pas de l'identifiant du compte.
    const storagePath = `${userId}/${randomUUID()}${extFromMime(input.mimeType)}`;
    const { signedUrl, token } = await this.storage.createSignedUploadUrl(bucket, storagePath);
    const uploadId = randomUUID();
    const metadata: AvatarUploadMetadata = { userId, scope: 'AVATAR', bucket, storagePath, mimeType: input.mimeType, sizeBytes: input.sizeBytes };
    await this.redis.set(CacheKeys.upload(uploadId), JSON.stringify(metadata), TICKET_TTL_SECONDS);
    return { uploadId, signedUrl, token, expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000) };
  }

  /** Consomme le ticket (usage unique), vérifie le fichier réellement déposé, puis l'adopte comme photo du compte. */
  async register(userId: string, uploadId: string) {
    const raw = await this.redis.getDel(CacheKeys.upload(uploadId));
    if (!raw) throw new UnprocessableError('UPLOAD_EXPIRED');
    const meta = JSON.parse(raw) as AvatarUploadMetadata;
    if (meta.userId !== userId || meta.scope !== 'AVATAR') throw new UnprocessableError('UPLOAD_MISMATCH');

    const stored = await this.storage.getObjectInfo(meta.bucket, meta.storagePath);
    if (!stored.exists) throw new UnprocessableError('UPLOAD_NOT_FOUND');
    if (stored.sizeBytes <= 0 || stored.sizeBytes > AVATAR_LIMIT_BYTES) {
      await this.storage.deleteObject(meta.bucket, meta.storagePath);
      throw new UnprocessableError('FILE_TOO_LARGE');
    }
    if (stored.mimeType && stored.mimeType !== meta.mimeType) {
      await this.storage.deleteObject(meta.bucket, meta.storagePath);
      throw new UnprocessableError('MIME_TYPE_MISMATCH');
    }

    const url = this.storage.publicUrl(meta.bucket, meta.storagePath);
    const previous = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { avatar: url } }),
      this.prisma.tutorProfile.updateMany({ where: { userId }, data: { profilePhoto: url } }),
    ]);
    await this.removeObjectOf(previous?.avatar);
    return { avatar: url };
  }

  async remove(userId: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { avatar: null } }),
      // La fiche publique du tuteur ne perd sa photo que si c'était celle du compte (pas une photo saisie à part).
      ...(current?.avatar ? [this.prisma.tutorProfile.updateMany({ where: { userId, profilePhoto: current.avatar }, data: { profilePhoto: null } })] : []),
    ]);
    await this.removeObjectOf(current?.avatar);
    return { avatar: null };
  }

  /** Supprime du stockage l'ancienne photo, si (et seulement si) c'est un de nos objets. Au mieux : sans effet en cas d'échec. */
  private async removeObjectOf(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const prefix = this.storage.publicUrl(this.cfg.avatarsBucket, '');
    if (!url.startsWith(prefix)) return;
    await this.storage.deleteObject(this.cfg.avatarsBucket, url.slice(prefix.length)).catch(() => undefined);
  }
}
