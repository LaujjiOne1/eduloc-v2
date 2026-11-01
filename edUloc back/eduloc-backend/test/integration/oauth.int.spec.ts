/**
 * Connexion sociale (création, liaison, refus) : base PostgreSQL RÉELLE, migrations appliquées. À lancer avec :
 *
 *   TEST_DATABASE_URL=postgresql://eduloc:eduloc@localhost:5433/eduloc_oauth_test npm run test:int
 *
 * Ne jamais pointer vers la base de développement ni Supabase. Chaque exécution crée ses données et les supprime.
 * Le fournisseur est simulé (IdentityResolver) : la vérification des jetons est couverte par test/unit/oauth.spec.ts.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/core/prisma/prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { OAuthService } from '../../src/modules/auth/oauth/oauth.service';
import type { IdentityResolver } from '../../src/modules/auth/oauth/identity-resolver';
import type { OAuthIdentity } from '../../src/modules/auth/oauth/oauth-identity';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'TEST_DATABASE_URL absent : tests d’intégration ignorés';

const run = randomUUID().slice(0, 8);
const pool = new pg.Pool({ connectionString: url, max: 4 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const db = prisma as unknown as PrismaService;

let nextIdentity: OAuthIdentity;
const resolver = { resolve: async () => nextIdentity } as unknown as IdentityResolver;
const auth = { openSession: async (u: { id: string }) => ({ user: { id: u.id } }) } as unknown as AuthService;
const rateLimit = { consume: async () => undefined } as never;
const oauth = new OAuthService(db, resolver, auth, rateLimit);

const emails: string[] = [];
const email = (label: string) => {
  const value = `oauth-${run}-${label}@example.mg`;
  emails.push(value);
  return value;
};
const identity = (label: string, overrides: Partial<OAuthIdentity> = {}): OAuthIdentity => ({
  provider: 'GOOGLE', providerUserId: `g-${run}-${label}`, email: email(label), emailVerified: true, firstName: 'Aina', lastName: 'Rakoto', ...overrides,
});
const exchange = (id: OAuthIdentity) => {
  nextIdentity = id;
  return oauth.exchange({ provider: 'google', token: 'x'.repeat(20) }, '127.0.0.1');
};
const code = (promise: Promise<unknown>) => promise.then(() => 'OK', (e: { message?: string }) => e.message ?? 'ERR');
const makeUser = (label: string, data: Record<string, unknown> = {}) =>
  prisma.user.create({
    data: { firstName: 'Lova', lastName: 'R', email: email(label), password: 'hash', status: 'ACTIVE', emailVerified: true, ...data } as never,
  });

describe('connexion sociale', { skip }, () => {
  after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }); // les comptes liés partent en cascade
    await prisma.$disconnect();
    await pool.end();
  });

  it('crée un compte sans mot de passe, actif et vérifié, avec son compte lié', async () => {
    const id = identity('create');
    const result = (await exchange(id)) as { user: { id: string }; created: boolean };
    assert.equal(result.created, true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id }, include: { oauthAccounts: true } });
    assert.equal(user.password, null);
    assert.equal(user.status, 'ACTIVE');
    assert.equal(user.emailVerified, true);
    assert.equal(user.email, id.email);
    assert.equal(user.oauthAccounts.length, 1);
    assert.equal(user.oauthAccounts[0].providerUserId, id.providerUserId);
  });

  it('reconnecte le même compte à la connexion suivante, sans doublon', async () => {
    const id = identity('again');
    const first = (await exchange(id)) as { user: { id: string } };
    const second = (await exchange(id)) as { user: { id: string }; created: boolean };
    assert.equal(second.user.id, first.user.id);
    assert.equal(second.created, false);
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: first.user.id } }), 1);
  });

  it('suit le compte même si l\'e-mail change chez le fournisseur', async () => {
    const id = identity('moved');
    const first = (await exchange(id)) as { user: { id: string } };
    const second = (await exchange({ ...id, email: email('moved-new') })) as { user: { id: string } };
    assert.equal(second.user.id, first.user.id);
  });

  it('lie le fournisseur à un compte existant quand l\'e-mail est attesté (le mot de passe reste valable)', async () => {
    const existing = await makeUser('link');
    const result = (await exchange(identity('link', { email: existing.email }))) as { user: { id: string }; created: boolean };
    assert.equal(result.user.id, existing.id);
    assert.equal(result.created, false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    assert.equal(after.password, 'hash');
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: existing.id } }), 1);
  });

  it('permet à un même compte de lier plusieurs fournisseurs', async () => {
    const existing = await makeUser('multi');
    await exchange(identity('multi-g', { email: existing.email }));
    await exchange(identity('multi-a', { email: existing.email, provider: 'APPLE' }));
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: existing.id } }), 2);
  });

  it('refuse de lier ou créer quand le fournisseur n\'atteste pas l\'e-mail', async () => {
    const existing = await makeUser('unverified');
    assert.equal(await code(exchange(identity('unverified', { email: existing.email, emailVerified: false }))), 'OAUTH_EMAIL_UNVERIFIED');
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: existing.id } }), 0);
    assert.equal(await code(exchange(identity('unverified-new', { emailVerified: false }))), 'OAUTH_EMAIL_UNVERIFIED');
    assert.equal(await code(exchange(identity('noemail', { email: null, emailVerified: false }))), 'OAUTH_EMAIL_REQUIRED');
  });

  it('ne lie jamais automatiquement un administrateur', async () => {
    const admin = await makeUser('admin', { isAdmin: true });
    assert.equal(await code(exchange(identity('admin', { email: admin.email }))), 'OAUTH_LINK_FORBIDDEN');
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: admin.id } }), 0);
  });

  it('refuse un compte suspendu, lié ou non', async () => {
    const suspended = await makeUser('suspended', { status: 'SUSPENDED' });
    assert.equal(await code(exchange(identity('suspended', { email: suspended.email }))), 'ACCOUNT_DISABLED');
    const linked = (await exchange(identity('later-suspended'))) as { user: { id: string } };
    await prisma.user.update({ where: { id: linked.user.id }, data: { status: 'SUSPENDED' } });
    assert.equal(await code(exchange(identity('later-suspended', { email: emails[emails.length - 1] }))), 'ACCOUNT_DISABLED');
  });

  it('compte jamais vérifié : la liaison l\'active ET efface le mot de passe posé à l\'inscription', async () => {
    const hash = await argon2.hash('motdepasse-pirate', { type: argon2.argon2id });
    const squatted = await makeUser('squat', { status: 'PENDING_VERIFICATION', emailVerified: false, password: hash });
    await exchange(identity('squat', { email: squatted.email }));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: squatted.id } });
    assert.equal(after.status, 'ACTIVE');
    assert.equal(after.emailVerified, true);
    assert.equal(after.password, null);
  });

  it('deux connexions simultanées du même nouveau compte ne créent qu\'un seul compte', async () => {
    const id = identity('race');
    const results = (await Promise.all([exchange(id), exchange(id)])) as { user: { id: string } }[];
    assert.equal(results[0].user.id, results[1].user.id);
    assert.equal(await prisma.user.count({ where: { email: id.email as string } }), 1);
    assert.equal(await prisma.oAuthAccount.count({ where: { providerUserId: id.providerUserId } }), 1);
  });

  it('un compte créé par connexion sociale ne se connecte jamais par mot de passe', async () => {
    const id = identity('nopassword');
    await exchange(id);
    const crypto = {} as never;
    const tokens = {} as never;
    const passwordAuth = new AuthService(db, crypto, tokens, rateLimit);
    assert.equal(await code(passwordAuth.login({ email: id.email as string, password: 'nimporte-quoi-1234' }, '127.0.0.1')), 'INVALID_CREDENTIALS');
  });
});
