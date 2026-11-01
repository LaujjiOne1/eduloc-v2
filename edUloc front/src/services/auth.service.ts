import { api } from "@/api/http";
import { runBeforeLogout } from "@/lib/session-hooks";
import { getProviderCredential } from "@/lib/social-auth";
import { ApiError } from "@/api/errors";
import { Session } from "@/api/session";
import { toAuthenticatedUser } from "@/api/mappers";
import type { LoginResultDto, MeDto, RegisterResultDto } from "@/api/contracts/dto";
import type { AuthenticatedUser, LoginCredentials, OAuthProvider, SignupPayload } from "@/types/auth";
import { t } from "@/i18n";

/** Compat : les écrans testent `instanceof AuthServiceError` et `error.code`. */
export { ApiError as AuthServiceError };

/** Ouvre la session : jetons → profil complet (/users/me : rôle tuteur, bénéficiaire « moi »…). */
async function openSession(result: Pick<LoginResultDto, "accessToken" | "refreshToken" | "refreshExpiresAt">, remember = true): Promise<AuthenticatedUser> {
  Session.setPersistence(remember);
  await Session.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshExpiresAt: result.refreshExpiresAt,
  });
  const me = await api.get<MeDto>("/users/me");
  Session.setUser(me);
  return toAuthenticatedUser(me);
}

/**
 * Routes backend : POST /auth/register|verify-email|resend-verification|login|refresh|logout|
 * password/request|password/reset, GET /users/me.
 *
 * Parcours : register → (code à 6 chiffres reçu par e-mail) → verify-email, qui OUVRE la session
 * (pas de reconnexion) → l'écran suivant du workflow.
 */
export const AuthService = {
  /**
   * 403 EMAIL_NOT_VERIFIED (code "email_not_verified") : le compte existe mais n'est pas vérifié →
   * l'écran envoie l'utilisateur vers la saisie du code.
   */
  async login(credentials: LoginCredentials, options: { remember?: boolean } = {}): Promise<AuthenticatedUser> {
    if (!credentials.password) throw ApiError.local("invalid_credentials", t("services.authservice.incorrectEmailOrPassword"));
    const result = await api.post<LoginResultDto>("/auth/login", credentials, { auth: false });
    // « Rester connecté » décoché : la session ne survit pas à la fermeture de l'app (jetons en mémoire seulement).
    return openSession(result, options.remember ?? true);
  },

  /** Crée le compte (PENDING_VERIFICATION) et déclenche l'envoi du code. N'ouvre PAS de session. */
  async signup(payload: SignupPayload): Promise<AuthenticatedUser> {
    const registered = await api.post<RegisterResultDto>("/auth/register", payload, { auth: false });
    return {
      id: registered.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone ?? null,
      emailVerified: false,
      status: "pending_verification",
      selfBeneficiaryId: null,
      tutor: null,
      isAdmin: false,
    };
  },

  /** Valide le code à 6 chiffres et ouvre la session. Erreurs : "invalid_code" (422), "too_many_requests" (429). */
  async verifyEmail(email: string, code: string): Promise<AuthenticatedUser> {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) throw ApiError.local("invalid_code", t("common.enterThe6DigitsOf"));
    const result = await api.post<LoginResultDto>("/auth/verify-email", { email: email.trim(), code: digits }, { auth: false });
    return openSession(result);
  },

  /** Renvoie un nouveau code (3 / heure). La réponse ne révèle jamais si le compte existe. */
  async resendVerification(email: string): Promise<void> {
    await api.post("/auth/resend-verification", { email: email.trim() }, { auth: false });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await api.post("/auth/password/request", { email: email.trim() }, { auth: false });
  },

  /** Le code reçu par e-mail + le nouveau mot de passe. Toutes les sessions existantes sont révoquées. */
  async resetPassword(input: { email: string; code: string; password: string }): Promise<void> {
    await api.post(
      "/auth/password/reset",
      { email: input.email.trim(), code: input.code.replace(/\D/g, ""), password: input.password },
      { auth: false },
    );
  },

  /**
   * Connexion / inscription par Google, Apple ou Facebook : l'application obtient un jeton auprès du fournisseur (voir
   * lib/social-auth), le serveur le vérifie lui-même, lie ou crée le compte et ouvre la session EduLoc (POST /auth/oauth/exchange).
   * Erreurs : "provider_not_configured" (pas encore branché), "social_cancelled" (fenêtre fermée), 401/422/403/503 du serveur
   * (jeton refusé, e-mail absent ou non vérifié, compte désactivé, fournisseur non configuré côté serveur).
   */
  async loginWithProvider(provider: OAuthProvider, options: { remember?: boolean } = {}): Promise<AuthenticatedUser> {
    const credential = await getProviderCredential(provider);
    if (!credential) throw ApiError.local("social_cancelled");
    const result = await api.post<LoginResultDto & { created?: boolean }>("/auth/oauth/exchange", { provider, ...credential }, { auth: false });
    return openSession(result, options.remember ?? true);
  },

  /** Au démarrage de l'app : relit les jetons persistés puis /users/me. */
  async restoreSession(): Promise<AuthenticatedUser | null> {
    if (!(await Session.restore())) return null;
    try {
      return await AuthService.getMe();
    } catch (error) {
      // Session refusée par le serveur : on la purge. Panne réseau : on garde les jetons (mode hors ligne).
      if (error instanceof ApiError && (error.status === 401 || error.code === "unauthorized")) {
        await Session.clear();
        return null;
      }
      throw error;
    }
  },

  /** Rafraîchit le profil (ex. après envoi de candidature ou approbation). */
  async getMe(): Promise<AuthenticatedUser> {
    const me = await api.get<MeDto>("/users/me");
    Session.setUser(me);
    return toAuthenticatedUser(me);
  },

  /**
   * @param options.revoke faux : le jeton n'est PAS révoqué côté serveur, car l'appelant vient de le mettre de côté dans le
   *        coffre de l'appareil pour une reconnexion d'un toucher (voir lib/device-vault). Vrai par défaut.
   */
  async logout(options: { revoke?: boolean } = {}): Promise<void> {
    await runBeforeLogout();
    const refreshToken = Session.getTokens()?.refreshToken;
    if (refreshToken && options.revoke !== false) await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    await Session.clear();
  },

  /**
   * Reconnexion d'un toucher : échange un jeton gardé dans le coffre contre une session neuve (POST /auth/refresh, qui
   * renouvelle le jeton : l'ancien devient inutilisable). Erreurs : 401 = jeton refusé ou expiré, "network_error" = hors ligne.
   */
  async resumeSession(refreshToken: string): Promise<AuthenticatedUser> {
    const result = await api.post<{ accessToken: string; refreshToken: string; expiresAt: string }>("/auth/refresh", { refreshToken }, { auth: false });
    return openSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, refreshExpiresAt: result.expiresAt }, true);
  },

  /** Révoque un jeton qui n'est pas celui de la session ouverte (compte oublié). Au mieux : sans effet si hors ligne. */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await api.post("/auth/logout", { refreshToken }, { auth: false }).catch(() => undefined);
  },
};
