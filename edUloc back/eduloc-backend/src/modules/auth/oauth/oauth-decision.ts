import type { OAuthIdentity } from './oauth-identity';

export interface KnownUser {
  id: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  deletedAt: Date | null;
  isAdmin: boolean;
}

export type OAuthDecision =
  /** Le compte fournisseur est déjà lié : on connecte. */
  | { action: 'login'; userId: string; activate: boolean }
  /** L'e-mail (attesté par le fournisseur) est celui d'un compte existant : on lie ce fournisseur à ce compte. */
  | { action: 'link'; userId: string; activate: boolean }
  /** Personne ne correspond : on crée un compte sans mot de passe. */
  | { action: 'create' }
  | { action: 'reject'; code: 'ACCOUNT_DISABLED' | 'OAUTH_EMAIL_REQUIRED' | 'OAUTH_EMAIL_UNVERIFIED' | 'OAUTH_LINK_FORBIDDEN' };

const disabled = (user: KnownUser) => !!user.deletedAt || user.status === 'SUSPENDED';

/**
 * Règles de liaison (les cas A et B du schéma « comptes liés »), pures donc testables sans base :
 *  A. « fournisseur + identifiant » déjà lié → connexion.
 *  B. sinon, e-mail connu → liaison ; e-mail inconnu → création.
 * Garde-fous contre la prise de contrôle de compte :
 *  - on ne lie à un compte existant que si le fournisseur ATTESTE l'e-mail (sinon n'importe qui peut déclarer l'e-mail d'autrui) ;
 *  - jamais de liaison automatique à un administrateur ;
 *  - un compte jamais vérifié est activé par cette attestation (l'appelant efface alors son mot de passe : il avait pu être
 *    posé par celui qui a lancé l'inscription sans posséder la boîte mail).
 */
export function decideOAuthSignIn(input: { linked: KnownUser | null; emailOwner: KnownUser | null; identity: OAuthIdentity }): OAuthDecision {
  const { linked, emailOwner, identity } = input;

  if (linked) {
    if (disabled(linked)) return { action: 'reject', code: 'ACCOUNT_DISABLED' };
    return { action: 'login', userId: linked.id, activate: linked.status === 'PENDING_VERIFICATION' };
  }

  if (!identity.email) return { action: 'reject', code: 'OAUTH_EMAIL_REQUIRED' };
  if (!identity.emailVerified) return { action: 'reject', code: 'OAUTH_EMAIL_UNVERIFIED' };

  if (emailOwner) {
    if (disabled(emailOwner)) return { action: 'reject', code: 'ACCOUNT_DISABLED' };
    if (emailOwner.isAdmin) return { action: 'reject', code: 'OAUTH_LINK_FORBIDDEN' };
    return { action: 'link', userId: emailOwner.id, activate: emailOwner.status === 'PENDING_VERIFICATION' };
  }
  return { action: 'create' };
}
