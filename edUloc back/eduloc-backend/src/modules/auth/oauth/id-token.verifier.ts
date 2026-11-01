import { UnauthorizedException } from '@nestjs/common';
import { createHash, createPublicKey, verify as verifySignature, type JsonWebKey as NodeJwk } from 'node:crypto';

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  nonce?: string;
  email?: string;
  /** Google : booléen ; Apple : parfois la chaîne « true ». */
  email_verified?: boolean | string;
  given_name?: string;
  family_name?: string;
}

interface Jwk extends NodeJwk {
  kid?: string;
}

export interface IdTokenVerifierOptions {
  /** Clés publiques du fournisseur (JWKS). */
  jwksUrl: string;
  /** Émetteurs acceptés (claim iss). */
  issuers: string[];
  /** Destinataires acceptés (claim aud) : NOS identifiants client, jamais ceux d'une autre application. */
  audiences: string[];
}

const LEEWAY_SECONDS = 5;
const JWKS_TTL_MS = 60 * 60_000;
/** Une clé inconnue ne relance un téléchargement qu'au plus une fois par minute (le vérificateur ne doit pas amplifier une attaque). */
const JWKS_MIN_REFETCH_MS = 60_000;

/**
 * Vérifie un jeton d'identité OpenID (Google, Apple) : signature RS256 contre les clés publiques du fournisseur, émetteur,
 * destinataire, dates et, si fourni, nonce. Aucune dépendance : l'API cryptographique de Node suffit. Rien n'est cru avant
 * que la signature soit valide.
 */
export class IdTokenVerifier {
  private keys: Jwk[] = [];
  private fetchedAt = 0;

  constructor(private readonly options: IdTokenVerifierOptions) {}

  /** Téléchargement des clés (remplaçable en test). */
  fetchJson: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`JWKS HTTP ${response.status}`);
    return response.json();
  };

  async verify(token: string, expected: { nonce?: string } = {}, now: number = Math.floor(Date.now() / 1000)): Promise<IdTokenClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) throw this.invalid();
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    let header: { alg?: string; kid?: string };
    let claims: Partial<IdTokenClaims>;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw this.invalid();
    }
    // Algorithme imposé : « none » ou HS256 (jeton « signé » avec une clé publique) ne passent jamais.
    if (header.alg !== 'RS256' || !header.kid) throw this.invalid();

    const jwk = await this.keyFor(header.kid);
    if (!jwk) throw this.invalid();
    let valid = false;
    try {
      valid = verifySignature(
        'RSA-SHA256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        createPublicKey({ key: jwk, format: 'jwk' }),
        Buffer.from(encodedSignature, 'base64url'),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw this.invalid();

    if (typeof claims.sub !== 'string' || !claims.sub) throw this.invalid();
    if (typeof claims.iss !== 'string' || !this.options.issuers.includes(claims.iss)) throw this.invalid();
    const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (!audiences.some((a) => this.options.audiences.includes(a))) throw this.invalid();
    if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_SECONDS < now) throw this.invalid();
    if (typeof claims.nbf === 'number' && claims.nbf - LEEWAY_SECONDS > now) throw this.invalid();
    if (expected.nonce !== undefined) {
      // Le client envoie sa valeur brute ; selon la plateforme, le fournisseur y met la valeur telle quelle ou son SHA-256 (hex).
      const hashed = createHash('sha256').update(expected.nonce).digest('hex');
      if (claims.nonce !== expected.nonce && claims.nonce !== hashed) throw this.invalid();
    }
    return claims as IdTokenClaims;
  }

  private async keyFor(kid: string): Promise<Jwk | null> {
    const known = () => this.keys.find((k) => k.kid === kid) ?? null;
    const age = Date.now() - this.fetchedAt;
    if (this.keys.length === 0 || age > JWKS_TTL_MS || (!known() && age > JWKS_MIN_REFETCH_MS)) {
      try {
        const body = (await this.fetchJson(this.options.jwksUrl)) as { keys?: Jwk[] };
        this.keys = Array.isArray(body.keys) ? body.keys : [];
        this.fetchedAt = Date.now();
      } catch {
        // Clés injoignables : on garde celles déjà connues, sinon le jeton est refusé (jamais accepté sans vérification).
      }
    }
    return known();
  }

  private invalid(): UnauthorizedException {
    return new UnauthorizedException('OAUTH_TOKEN_INVALID');
  }
}
