export type OAuthProviderName = 'GOOGLE' | 'APPLE' | 'FACEBOOK';

/** Noms utilisés par l'API (minuscules) → valeur de l'enum Prisma. */
export const PROVIDER_BY_NAME: Record<string, OAuthProviderName> = {
  google: 'GOOGLE',
  apple: 'APPLE',
  facebook: 'FACEBOOK',
};

/** Ce que le fournisseur certifie d'un utilisateur : de quoi lier ou créer un compte EduLoc. */
export interface OAuthIdentity {
  provider: OAuthProviderName;
  /** Identifiant stable chez le fournisseur (sub Google, sub Apple, id Facebook). La clé de liaison, jamais l'e-mail. */
  providerUserId: string;
  /** Peut être un relais Apple (« xxx@privaterelay.appleid.com ») ou absent (Facebook sans e-mail). */
  email: string | null;
  /**
   * Le fournisseur atteste que l'e-mail appartient bien à l'utilisateur : claim `email_verified` de Google et d'Apple.
   * Facebook ne renvoie qu'une adresse confirmée de son côté : elle est traitée comme attestée (hypothèse documentée dans
   * docs/oauth-social-login.md).
   */
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
}
