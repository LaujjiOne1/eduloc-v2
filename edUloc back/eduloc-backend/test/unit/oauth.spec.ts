import assert from 'node:assert/strict';
import { createHash, createHmac, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, it } from 'node:test';
import type { AppConfig } from '../../src/core/config/app.config';
import { IdTokenVerifier } from '../../src/modules/auth/oauth/id-token.verifier';
import { IdentityResolver } from '../../src/modules/auth/oauth/identity-resolver';
import { decideOAuthSignIn, type KnownUser } from '../../src/modules/auth/oauth/oauth-decision';
import type { OAuthIdentity } from '../../src/modules/auth/oauth/oauth-identity';

const NOW = 1_800_000_000;
const b64 = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = (key: KeyObject, kid: string) => ({ ...key.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' });
const JWKS = { keys: [jwk(pair.publicKey, 'k1')] };

function token(claims: Record<string, unknown>, options: { key?: KeyObject; kid?: string; alg?: string } = {}) {
  const header = b64({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'k1', typ: 'JWT' });
  const payload = b64(claims);
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), options.key ?? pair.privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

const base = { sub: '109876543210', iss: 'https://accounts.google.com', aud: 'google-client', exp: NOW + 600, email: 'Aina@Example.mg', email_verified: true };
const verifier = () => {
  const v = new IdTokenVerifier({ jwksUrl: 'https://keys.test/jwks', issuers: ['https://accounts.google.com', 'accounts.google.com'], audiences: ['google-client'] });
  v.fetchJson = async () => JWKS;
  return v;
};

describe('vérification d\'un jeton d\'identité (Google, Apple)', () => {
  it('accepte un jeton bien signé, émis pour nous, non expiré', async () => {
    const claims = await verifier().verify(token(base), {}, NOW);
    assert.equal(claims.sub, base.sub);
  });

  it('refuse une signature qui n\'est pas celle du fournisseur', async () => {
    await assert.rejects(verifier().verify(token(base, { key: other.privateKey }), {}, NOW), /OAUTH_TOKEN_INVALID/);
  });

  it('refuse un jeton émis pour une AUTRE application (aud) ou un autre émetteur (iss)', async () => {
    await assert.rejects(verifier().verify(token({ ...base, aud: 'autre-app' }), {}, NOW), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(verifier().verify(token({ ...base, iss: 'https://evil.test' }), {}, NOW), /OAUTH_TOKEN_INVALID/);
    // aud en tableau : il suffit qu'un de nos identifiants y figure
    const ok = await verifier().verify(token({ ...base, aud: ['x', 'google-client'] }), {}, NOW);
    assert.equal(ok.sub, base.sub);
  });

  it('refuse un jeton expiré ou pas encore valable (tolérance de 5 s)', async () => {
    await assert.rejects(verifier().verify(token({ ...base, exp: NOW - 60 }), {}, NOW), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(verifier().verify(token({ ...base, nbf: NOW + 120 }), {}, NOW), /OAUTH_TOKEN_INVALID/);
    const slightly = await verifier().verify(token({ ...base, exp: NOW - 3 }), {}, NOW);
    assert.equal(slightly.sub, base.sub);
  });

  it('refuse « alg: none » et un jeton HS256 « signé » avec la clé publique', async () => {
    const none = `${b64({ alg: 'none', kid: 'k1' })}.${b64(base)}.`;
    await assert.rejects(verifier().verify(none, {}, NOW), /OAUTH_TOKEN_INVALID/);
    const header = b64({ alg: 'HS256', kid: 'k1' });
    const payload = b64(base);
    const forged = `${header}.${payload}.${createHmac('sha256', JSON.stringify(JWKS.keys[0])).update(`${header}.${payload}`).digest('base64url')}`;
    await assert.rejects(verifier().verify(forged, {}, NOW), /OAUTH_TOKEN_INVALID/);
  });

  it('refuse une clé inconnue et des jetons mal formés', async () => {
    await assert.rejects(verifier().verify(token(base, { kid: 'inconnue' }), {}, NOW), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(verifier().verify('pas-un-jeton', {}, NOW), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(verifier().verify('a.b.c', {}, NOW), /OAUTH_TOKEN_INVALID/);
  });

  it('sans clés joignables, refuse (jamais accepté sans vérification)', async () => {
    const v = verifier();
    v.fetchJson = async () => { throw new Error('réseau'); };
    await assert.rejects(v.verify(token(base), {}, NOW), /OAUTH_TOKEN_INVALID/);
  });

  it('contrôle le nonce brut ou son SHA-256', async () => {
    const hashed = createHash('sha256').update('abc').digest('hex');
    await verifier().verify(token({ ...base, nonce: 'abc' }), { nonce: 'abc' }, NOW);
    await verifier().verify(token({ ...base, nonce: hashed }), { nonce: 'abc' }, NOW);
    await assert.rejects(verifier().verify(token({ ...base, nonce: 'autre' }), { nonce: 'abc' }, NOW), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(verifier().verify(token(base), { nonce: 'abc' }, NOW), /OAUTH_TOKEN_INVALID/);
  });
});

const config = (partial: Partial<AppConfig['oauth']> = {}) => ({
  oauth: { googleClientIds: ['google-client'], appleClientIds: ['mg.eduloc.app'], facebook: { appId: 'fb-app', appSecret: 'fb-secret' }, ...partial },
}) as unknown as AppConfig;

describe('résolution d\'identité par fournisseur', () => {
  it('refuse un fournisseur non configuré (aucun jeton n\'est accepté par défaut)', async () => {
    const resolver = new IdentityResolver(config({ googleClientIds: [], facebook: null }));
    await assert.rejects(resolver.resolve({ provider: 'google', token: 'x'.repeat(20) }), /OAUTH_PROVIDER_DISABLED/);
    await assert.rejects(resolver.resolve({ provider: 'facebook', token: 'x'.repeat(20) }), /OAUTH_PROVIDER_DISABLED/);
    await assert.rejects(resolver.resolve({ provider: 'inconnu', token: 'x'.repeat(20) }), /OAUTH_PROVIDER_DISABLED/);
  });

  it('Google : identité = sub, e-mail en minuscules, attestation = email_verified', async () => {
    const resolver = new IdentityResolver(config());
    resolver.verifiers.google.fetchJson = async () => JWKS;
    const identity = await resolver.resolve({ provider: 'google', token: token({ ...base, exp: Date.now() / 1000 + 600, given_name: 'Aina', family_name: 'Rakoto' }) });
    assert.deepEqual(identity, { provider: 'GOOGLE', providerUserId: base.sub, email: 'aina@example.mg', emailVerified: true, firstName: 'Aina', lastName: 'Rakoto' });
    const unverified = await resolver.resolve({ provider: 'google', token: token({ ...base, exp: Date.now() / 1000 + 600, email_verified: false }) });
    assert.equal(unverified.emailVerified, false);
  });

  it('Apple : « email_verified » peut être la chaîne "true" ; le nom vient de l\'application', async () => {
    const resolver = new IdentityResolver(config());
    resolver.verifiers.apple.fetchJson = async () => JWKS;
    const apple = token({ sub: 'apple-1', iss: 'https://appleid.apple.com', aud: 'mg.eduloc.app', exp: Date.now() / 1000 + 600, email: 'x@privaterelay.appleid.com', email_verified: 'true' });
    const identity = await resolver.resolve({ provider: 'apple', token: apple, firstName: ' Lova ', lastName: 'R' });
    assert.equal(identity.providerUserId, 'apple-1');
    assert.equal(identity.emailVerified, true);
    assert.equal(identity.firstName, 'Lova');
  });

  const graph = (map: Record<string, unknown>) => async (url: string) => {
    const hit = Object.keys(map).find((fragment) => url.includes(fragment));
    if (!hit) throw new Error(`appel inattendu ${url}`);
    return map[hit];
  };

  it('Facebook : jeton valide pour NOTRE application, profil cohérent', async () => {
    const resolver = new IdentityResolver(config());
    resolver.fetchJson = graph({
      '/debug_token': { data: { is_valid: true, app_id: 'fb-app', user_id: '42', expires_at: 0 } },
      '/me?': { id: '42', first_name: 'Lova', last_name: 'R', email: 'LOVA@example.mg' },
    });
    const identity = await resolver.resolve({ provider: 'facebook', token: 'x'.repeat(20) });
    assert.deepEqual(identity, { provider: 'FACEBOOK', providerUserId: '42', email: 'lova@example.mg', emailVerified: true, firstName: 'Lova', lastName: 'R' });
  });

  it('Facebook : refuse un jeton d\'une autre application, invalide, expiré, ou un profil qui ne correspond pas', async () => {
    const attempt = (debug: unknown, profile: unknown = { id: '42' }) => {
      const resolver = new IdentityResolver(config());
      resolver.fetchJson = graph({ '/debug_token': { data: debug }, '/me?': profile });
      return resolver.resolve({ provider: 'facebook', token: 'x'.repeat(20) });
    };
    await assert.rejects(attempt({ is_valid: true, app_id: 'autre', user_id: '42' }), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(attempt({ is_valid: false, app_id: 'fb-app', user_id: '42' }), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(attempt({ is_valid: true, app_id: 'fb-app', user_id: '42', expires_at: 1000 }), /OAUTH_TOKEN_INVALID/);
    await assert.rejects(attempt({ is_valid: true, app_id: 'fb-app', user_id: '42' }, { id: '99' }), /OAUTH_TOKEN_INVALID/);
  });

  it('Facebook sans e-mail : pas d\'attestation (la décision refusera)', async () => {
    const resolver = new IdentityResolver(config());
    resolver.fetchJson = graph({ '/debug_token': { data: { is_valid: true, app_id: 'fb-app', user_id: '42' } }, '/me?': { id: '42', first_name: 'Lova' } });
    const identity = await resolver.resolve({ provider: 'facebook', token: 'x'.repeat(20) });
    assert.equal(identity.email, null);
    assert.equal(identity.emailVerified, false);
  });

  it('Facebook : une panne réseau ne donne jamais accès', async () => {
    const resolver = new IdentityResolver(config());
    resolver.fetchJson = async () => { throw new Error('réseau'); };
    await assert.rejects(resolver.resolve({ provider: 'facebook', token: 'x'.repeat(20) }), /OAUTH_TOKEN_INVALID/);
  });
});

const identity = (overrides: Partial<OAuthIdentity> = {}): OAuthIdentity => ({
  provider: 'GOOGLE', providerUserId: 'g-1', email: 'aina@example.mg', emailVerified: true, firstName: 'Aina', lastName: 'R', ...overrides,
});
const user = (overrides: Partial<KnownUser> = {}): KnownUser => ({ id: 'u1', status: 'ACTIVE', deletedAt: null, isAdmin: false, ...overrides });

describe('règles de liaison des comptes', () => {
  it('A — compte fournisseur déjà lié : connexion, même si l\'e-mail a changé', () => {
    assert.deepEqual(decideOAuthSignIn({ linked: user(), emailOwner: null, identity: identity({ email: 'nouveau@example.mg' }) }), { action: 'login', userId: 'u1', activate: false });
  });

  it('B — e-mail connu et attesté : liaison ; inconnu : création', () => {
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: user(), identity: identity() }), { action: 'link', userId: 'u1', activate: false });
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: null, identity: identity() }), { action: 'create' });
  });

  it('jamais de liaison ni de création sans e-mail attesté (prise de contrôle de compte)', () => {
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: user(), identity: identity({ emailVerified: false }) }), { action: 'reject', code: 'OAUTH_EMAIL_UNVERIFIED' });
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: null, identity: identity({ emailVerified: false }) }), { action: 'reject', code: 'OAUTH_EMAIL_UNVERIFIED' });
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: null, identity: identity({ email: null, emailVerified: false }) }), { action: 'reject', code: 'OAUTH_EMAIL_REQUIRED' });
  });

  it('jamais de liaison automatique à un administrateur', () => {
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: user({ isAdmin: true }), identity: identity() }), { action: 'reject', code: 'OAUTH_LINK_FORBIDDEN' });
  });

  it('compte suspendu ou supprimé : refusé, qu\'il soit lié ou retrouvé par e-mail', () => {
    for (const disabled of [user({ status: 'SUSPENDED' }), user({ deletedAt: new Date() })]) {
      assert.deepEqual(decideOAuthSignIn({ linked: disabled, emailOwner: null, identity: identity() }), { action: 'reject', code: 'ACCOUNT_DISABLED' });
      assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: disabled, identity: identity() }), { action: 'reject', code: 'ACCOUNT_DISABLED' });
    }
  });

  it('compte jamais vérifié : la liaison l\'active (et l\'appelant efface son mot de passe)', () => {
    assert.deepEqual(decideOAuthSignIn({ linked: null, emailOwner: user({ status: 'PENDING_VERIFICATION' }), identity: identity() }), { action: 'link', userId: 'u1', activate: true });
  });
});
