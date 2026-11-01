import { useCallback, useState } from "react";

import { ApiError } from "@/api/errors";
import { t } from "@/i18n";
import { AuthService } from "@/services/auth.service";
import type { AuthenticatedUser, OAuthProvider } from "@/types/auth";

/**
 * Connexion sociale partagée par l'écran de connexion et celui d'inscription : un seul fournisseur à la fois, la fermeture
 * de la fenêtre du fournisseur n'est pas une erreur, tout le reste est expliqué à l'utilisateur.
 */
export function useSocialSignIn(onSuccess: (user: AuthenticatedUser) => void, remember = true) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const continueWith = useCallback(
    async (provider: OAuthProvider) => {
      if (pending) return;
      setError(null);
      setPending(provider);
      try {
        onSuccess(await AuthService.loginWithProvider(provider, { remember }));
      } catch (e) {
        if (e instanceof ApiError && e.code === "social_cancelled") return;
        setError(e instanceof ApiError ? e.message : t("common.anErrorOccurredPleaseTry"));
      } finally {
        setPending(null);
      }
    },
    [pending, onSuccess, remember],
  );

  return { pending, error, continueWith, clearError: () => setError(null) };
}
