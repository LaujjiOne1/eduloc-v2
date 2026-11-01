import { ApiError } from "@/api/errors";
import { t } from "@/i18n";
import type { OAuthProvider } from "@/types/auth";

/**
 * Ce que l'application obtient AUPRÈS du fournisseur et envoie au serveur (qui le vérifie lui-même) :
 *  - Google : le jeton d'identité (idToken) ;
 *  - Apple : le jeton d'identité (identityToken), plus le nom — Apple ne le donne qu'à la toute première autorisation ;
 *  - Facebook : le jeton d'accès.
 * `nonce` : valeur brute envoyée au fournisseur pour lier le jeton à cette tentative (recommandé).
 */
export interface ProviderCredential {
  token: string;
  nonce?: string;
  firstName?: string;
  lastName?: string;
}

/** Ouvre la fenêtre / la feuille du fournisseur. Renvoie null si l'utilisateur la ferme sans choisir. */
export type ProviderAdapter = () => Promise<ProviderCredential | null>;

const adapters: Partial<Record<OAuthProvider, ProviderAdapter>> = {};

/**
 * Point de branchement des SDK natifs. Tant qu'aucun adaptateur n'est enregistré pour un fournisseur, son bouton s'affiche
 * mais répond « pas encore disponible » : l'interface et le contrat serveur sont prêts, il ne manque que cette fonction
 * (voir SOCIAL_LOGIN.md à la racine de l'application).
 */
export function registerSocialAuthAdapter(provider: OAuthProvider, adapter: ProviderAdapter): void {
  adapters[provider] = adapter;
}

export function isSocialAuthAvailable(provider: OAuthProvider): boolean {
  return adapters[provider] !== undefined;
}

export async function getProviderCredential(provider: OAuthProvider): Promise<ProviderCredential | null> {
  const adapter = adapters[provider];
  if (!adapter) throw ApiError.local("provider_not_configured", t("services.authservice.thisSignInMethodIs"));
  return adapter();
}
