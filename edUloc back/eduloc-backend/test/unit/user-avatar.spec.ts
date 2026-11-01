import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { UserAvatarService } from '../../src/modules/users/user-avatar.service';
import type { StorageProvider } from '../../src/infrastructure/storage/storage-provider.port';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PREFIX = 'https://cdn.test/public/avatars/';

function build(options: { stored?: { exists: boolean; sizeBytes: number; mimeType: string }; previousAvatar?: string | null } = {}) {
  const redis = new Map<string, string>();
  const deleted: string[] = [];
  const db = { avatar: options.previousAvatar ?? null as string | null, tutorPhoto: options.previousAvatar ?? null as string | null, tutor: true };
  const storage = {
    createSignedUploadUrl: async (_b: string, path: string) => ({ signedUrl: `https://up.test/${path}`, token: 't', storagePath: path }),
    publicUrl: (_b: string, path: string) => `${PREFIX}${path}`,
    getObjectInfo: async () => options.stored ?? { exists: true, sizeBytes: 1000, mimeType: 'image/jpeg' },
    deleteObject: async (_b: string, path: string) => { deleted.push(path); },
  } as unknown as StorageProvider;
  const prisma = {
    user: {
      findUnique: async () => ({ avatar: db.avatar }),
      update: async ({ data }: { data: { avatar: string | null } }) => { db.avatar = data.avatar; },
    },
    tutorProfile: {
      updateMany: async ({ where, data }: { where: { profilePhoto?: string }; data: { profilePhoto: string | null } }) => {
        if (db.tutor && (where.profilePhoto === undefined || where.profilePhoto === db.tutorPhoto)) db.tutorPhoto = data.profilePhoto;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const redisService = {
    set: async (k: string, v: string) => { redis.set(k, v); },
    getDel: async (k: string) => { const v = redis.get(k) ?? null; redis.delete(k); return v; },
  };
  const service = new UserAvatarService({ avatarsBucket: 'avatars' } as never, prisma as never, redisService as never, storage);
  return { service, db, deleted, redis };
}

describe('photo de profil', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => { ctx = build(); });

  it('refuse un type de fichier ou une taille hors limites avant tout envoi', async () => {
    await assert.rejects(ctx.service.createTicket(USER, { mimeType: 'application/pdf', sizeBytes: 1000 }), /MIME_TYPE_NOT_ALLOWED/);
    await assert.rejects(ctx.service.createTicket(USER, { mimeType: 'image/png', sizeBytes: 6 * 1024 * 1024 }), /FILE_TOO_LARGE/);
  });

  it('place le fichier sous le dossier du compte avec un nom non devinable', async () => {
    const ticket = await ctx.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    assert.match(ticket.signedUrl, new RegExp(`/${USER}/[0-9a-f-]{36}\\.jpg$`));
  });

  it('enregistre la photo : URL publique sur le compte ET sur la fiche tuteur', async () => {
    const ticket = await ctx.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    const { avatar } = await ctx.service.register(USER, ticket.uploadId);
    assert.ok(avatar.startsWith(PREFIX));
    assert.equal(ctx.db.avatar, avatar);
    assert.equal(ctx.db.tutorPhoto, avatar);
  });

  it('un ticket ne sert qu\'une fois et seulement à son propriétaire', async () => {
    const ticket = await ctx.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    await assert.rejects(ctx.service.register(OTHER, ticket.uploadId), /UPLOAD_MISMATCH/);
    // Le ticket a été consommé par la tentative ci-dessus : même le propriétaire ne peut plus le rejouer.
    await assert.rejects(ctx.service.register(USER, ticket.uploadId), /UPLOAD_EXPIRED/);
  });

  it('supprime un fichier déposé trop gros ou d\'un autre type que celui annoncé', async () => {
    const big = build({ stored: { exists: true, sizeBytes: 9 * 1024 * 1024, mimeType: 'image/jpeg' } });
    const t1 = await big.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    await assert.rejects(big.service.register(USER, t1.uploadId), /FILE_TOO_LARGE/);
    assert.equal(big.deleted.length, 1);

    const other = build({ stored: { exists: true, sizeBytes: 1000, mimeType: 'image/png' } });
    const t2 = await other.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    await assert.rejects(other.service.register(USER, t2.uploadId), /MIME_TYPE_MISMATCH/);
    assert.equal(other.deleted.length, 1);
  });

  it('refuse un fichier jamais déposé', async () => {
    const missing = build({ stored: { exists: false, sizeBytes: 0, mimeType: '' } });
    const ticket = await missing.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    await assert.rejects(missing.service.register(USER, ticket.uploadId), /UPLOAD_NOT_FOUND/);
  });

  it('remplacer la photo supprime l\'ancien fichier, mais jamais une adresse qui n\'est pas la nôtre', async () => {
    const own = build({ previousAvatar: `${PREFIX}${USER}/old.jpg` });
    const t1 = await own.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    await own.service.register(USER, t1.uploadId);
    assert.deepEqual(own.deleted, [`${USER}/old.jpg`]);

    const foreign = build({ previousAvatar: 'https://example.com/x.jpg' });
    const t2 = await foreign.service.createTicket(USER, { mimeType: 'image/jpeg', sizeBytes: 1000 });
    await foreign.service.register(USER, t2.uploadId);
    assert.deepEqual(foreign.deleted, []);
  });

  it('retirer la photo vide le compte et la fiche tuteur (si c\'était la même)', async () => {
    const own = build({ previousAvatar: `${PREFIX}${USER}/a.jpg` });
    await own.service.remove(USER);
    assert.equal(own.db.avatar, null);
    assert.equal(own.db.tutorPhoto, null);
    assert.deepEqual(own.deleted, [`${USER}/a.jpg`]);
  });
});
