import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app.config';
import { IdTokenVerifier, type IdTokenClaims } from './id-token.verifier';
import type { OAuthIdentity } from './oauth-identity';

export interface ResolveInput {
  /** « google », « apple » ou « facebook ». */
  provider: string;
  /** Jeton d'identité (Google, Apple) ou jeton d'accès (Facebook), obtenu par l'application auprès du fournisseur. */
  token: string;
  /** Valeur brute envoyée au fournisseur par l'application pour lier le jeton à la tentative (facultatif). */
  nonce?: string;
  /** Apple ne renvoie le nom qu'à la toute première autorisation : l'application nous le transmet alors (non certifié). */
  firstName?: string;
  lastName?: string;
}

const truthy = (value: boolean | string | undefined): boolean => value === true || value === 'true';

/**
 * Transforme un jeton de fournisseur en identité certifiée, sans service d'authentification tiers :
 *  - Google : jeton d'identité signé (RS256), clés publiques de Google ;
 *  - Apple : jeton d'identité signé (RS256), clés publiques d'Apple ;
 *  - Facebook : jeton d'accès contrôlé auprès de l'API Graph (debug_token), puis lecture du profil.
 * Un fournisseur non configuré est refusé (503) : aucune valeur par défaut qui accepterait n'importe quel jeton.
 */
@Injectable()
export class IdentityResolver {
  private readonly google: IdTokenVerifier;
  private readonly apple: IdTokenVerifier;

  constructor(private readonly cfg: AppConfig) {
    this.google = new IdTokenVerifier({
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
      audiences: cfg.oauth.googleClientIds,
    });
    this.apple = new IdTokenVerifier({
      jwksUrl: 'https://appleid.apple.com/auth/keys',
      issuers: ['https://appleid.apple.com'],
      audiences: cfg.oauth.appleClientIds,
    });
  }

  /** Accès aux vérificateurs pour les tests (clés injectées sans réseau). */
  get verifiers(): { google: IdTokenVerifier; apple: IdTokenVerifier } {
    return { google: this.google, apple: this.apple };
  }

  /** Appel HTTP vers l'API Graph (remplaçable en test). */
  fetchJson: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Graph HTTP ${response.status}`);
    return response.json();
  };

  isConfigured(provider: string): boolean {
    switch (provider) {
      case 'google': return this.cfg.oauth.googleClientIds.length > 0;
      case 'apple': return this.cfg.oauth.appleClientIds.length > 0;
      case 'facebook': return this.cfg.oauth.facebook !== null;
      default: return false;
    }
  }

  async resolve(input: ResolveInput): Promise<OAuthIdentity> {
    if (!this.isConfigured(input.provider)) throw new ServiceUnavailableException('OAUTH_PROVIDER_DISABLED');
    switch (input.provider) {
      case 'google': return this.fromGoogle(await this.google.verify(input.token, { nonce: input.nonce }));
      case 'apple': return this.fromApple(await this.apple.verify(input.token, { nonce: input.nonce }), input);
      default: return this.fromFacebook(input.token);
    }
  }

  private fromGoogle(claims: IdTokenClaims): OAuthIdentity {
    return {
      provider: 'GOOGLE',
      providerUserId: claims.sub,
      email: claims.email?.trim().toLowerCase() || null,
      emailVerified: truthy(claims.email_verified),
      firstName: claims.given_name ?? null,
      lastName: claims.family_name ?? null,
    };
  }

  private fromApple(claims: IdTokenClaims, input: ResolveInput): OAuthIdentity {
    return {
      provider: 'APPLE',
      providerUserId: claims.sub,
      // Apple n'envoie l'e-mail qu'à la première autorisation et peut le masquer derrière un relais : c'est un indice, pas la clé.
      email: claims.email?.trim().toLowerCase() || null,
      emailVerified: truthy(claims.email_verified),
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
    };
  }

  private async fromFacebook(accessToken: string): Promise<OAuthIdentity> {
    const facebook = this.cfg.oauth.facebook;
    if (!facebook) throw new ServiceUnavailableException('OAUTH_PROVIDER_DISABLED');
    const appToken = `${facebook.appId}|${facebook.appSecret}`;
    try {
      // 1. Le jeton est-il valide ET émis pour NOTRE application ? (un jeton d'une autre appli ne doit jamais ouvrir une session)
      const debug = (await this.fetchJson(
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
      )) as { data?: { is_valid?: boolean; app_id?: string; user_id?: string; expires_at?: number } };
      const data = debug.data;
      if (!data?.is_valid || data.app_id !== facebook.appId || !data.user_id) throw new UnauthorizedException('OAUTH_TOKEN_INVALID');
      if (typeof data.expires_at === 'number' && data.expires_at !== 0 && data.expires_at < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedException('OAUTH_TOKEN_INVALID');
      }

      // 2. Profil : l'identifiant doit être celui que Facebook vient de certifier.
      const profile = (await this.fetchJson(
        `https://graph.facebook.com/v19.0/me?fields=id,first_name,last_name,email&access_token=${encodeURIComponent(accessToken)}`,
      )) as { id?: string; first_name?: string; last_name?: string; email?: string };
      if (profile.id !== data.user_id) throw new UnauthorizedException('OAUTH_TOKEN_INVALID');
      return {
        provider: 'FACEBOOK',
        providerUserId: data.user_id,
        email: profile.email?.trim().toLowerCase() || null,
        // Facebook ne renvoie que l'adresse qu'il a confirmée : traitée comme attestée (voir OAuthIdentity).
        emailVerified: !!profile.email,
        firstName: profile.first_name ?? null,
        lastName: profile.last_name ?? null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('OAUTH_TOKEN_INVALID');
    }
  }
}
