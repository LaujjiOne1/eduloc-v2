import { ApiError } from "@/api/errors";
import { Session } from "@/api/session";
import {
  deleteParkedSession,
  deletePassword,
  parkSession,
  readParkedSession,
  readPassword,
  savePassword,
  unlockVault,
} from "@/lib/device-vault";
import { t } from "@/i18n";
import { registerForPush } from "@/lib/push";
import { runBeforeLogout } from "@/lib/session-hooks";
import { AuthService } from "@/services/auth.service";
import { type DeviceAccount, useDeviceAccountsStore } from "@/store/device-accounts.store";
import type { AuthenticatedUser } from "@/types/auth";

/**
 * Orchestration « comptes de l'appareil » : relie la liste (store, identité + indicateurs) au coffre (secrets) et au
 * serveur (révocation). Les écrans n'appellent que ces fonctions.
 */

export type QuickSignInResult =
  | { status: "ok"; user: AuthenticatedUser }
  | { status: "cancelled" }
  /** Aucun moyen automatique n'a marché : l'écran préremplit l'e-mail, l'utilisateur saisit son mot de passe. */
  | { status: "needs_password"; message?: string }
  | { status: "error"; message: string };

const isOffline = (error: unknown): error is ApiError => error instanceof ApiError && (error.code === "network_error" || error.code === "timeout");

function secretsOf(id: string) {
  return {
    clear: () => useDeviceAccountsStore.getState().setSecrets(id, { savedSession: false, savedPassword: false }),
    clearSession: () => useDeviceAccountsStore.getState().setSecrets(id, { savedSession: false }),
    clearPassword: () => useDeviceAccountsStore.getState().setSecrets(id, { savedPassword: false }),
  };
}

/** Efface les secrets d'un compte du coffre (et leurs indicateurs), en révoquant côté serveur le jeton qu'ils contenaient. */
async function wipeSecrets(id: string): Promise<void> {
  const parked = await readParkedSession(id);
  if (parked) void AuthService.revokeRefreshToken(parked.refreshToken);
  await Promise.all([deleteParkedSession(id), deletePassword(id)]);
  secretsOf(id).clear();
}

/**
 * Reconnexion d'un toucher à un compte de la liste. Toujours précédée d'un déverrouillage (empreinte, visage ou code).
 * Ordre : 1) jeton gardé, 2) mot de passe enregistré, 3) sinon l'utilisateur saisit son mot de passe.
 */
export async function quickSignIn(account: DeviceAccount, hooks: { beforeOpen?: () => Promise<boolean> } = {}): Promise<QuickSignInResult> {
  if (!(await unlockVault(t("screens.login.unlockReason")))) return { status: "cancelled" };
  // Changement de compte : l'appelant met le compte courant de côté juste avant d'ouvrir l'autre session.
  if (hooks.beforeOpen && !(await hooks.beforeOpen())) return { status: "error", message: t("screens.switchAccount.cannotKeepCurrent") };

  if (account.savedSession) {
    const parked = await readParkedSession(account.id);
    const expired = parked?.refreshExpiresAt ? Date.parse(parked.refreshExpiresAt) <= Date.now() : false;
    if (parked && !expired) {
      try {
        const user = await AuthService.resumeSession(parked.refreshToken);
        await deleteParkedSession(account.id); // l'ancien jeton vient d'être remplacé par le serveur
        secretsOf(account.id).clearSession();
        return { status: "ok", user };
      } catch (error) {
        // Hors ligne : on garde le jeton intact pour un nouvel essai. Refusé ou expiré : on l'écarte et on tente la suite.
        if (isOffline(error)) return { status: "error", message: error.message };
      }
    }
    await deleteParkedSession(account.id);
    secretsOf(account.id).clearSession();
  }

  if (account.savedPassword) {
    const password = await readPassword(account.id);
    if (password) {
      try {
        const user = await AuthService.login({ email: account.email, password }, { remember: true });
        return { status: "ok", user };
      } catch (error) {
        if (isOffline(error)) return { status: "error", message: error.message };
        if (error instanceof ApiError && (error.status === 401 || error.code === "invalid_credentials")) {
          // Le mot de passe a changé depuis : on n'en garde pas une copie périmée.
          await deletePassword(account.id);
          secretsOf(account.id).clearPassword();
          return { status: "needs_password", message: t("screens.login.savedPasswordNoLongerValid") };
        }
        return { status: "error", message: error instanceof ApiError ? error.message : t("common.anErrorOccurredPleaseTry") };
      }
    }
    secretsOf(account.id).clearPassword();
  }

  return { status: "needs_password" };
}

/** Mémorise le compte qui vient de se connecter ; si la liste déborde, les secrets du compte évincé sont effacés. */
export function rememberAccount(user: Pick<AuthenticatedUser, "id" | "firstName" | "lastName" | "email">): void {
  const store = useDeviceAccountsStore.getState();
  const before = store.accounts;
  store.remember(user);
  const kept = new Set(useDeviceAccountsStore.getState().accounts.map((a) => a.id));
  for (const dropped of before.filter((a) => !kept.has(a.id))) void wipeSecrets(dropped.id);
}

/** « Oublier ce compte sur cet appareil » : coffre vidé, jeton révoqué, compte retiré de la liste. */
export async function forgetDeviceAccount(id: string): Promise<void> {
  await wipeSecrets(id);
  useDeviceAccountsStore.getState().forget(id);
}

/** Après une connexion normale : un jeton gardé pour ce compte devient inutile, on le retire et on le révoque. */
export async function discardParkedSession(id: string): Promise<void> {
  const parked = await readParkedSession(id);
  if (!parked) return;
  void AuthService.revokeRefreshToken(parked.refreshToken);
  await deleteParkedSession(id);
  secretsOf(id).clearSession();
}

/** À la déconnexion : met de côté le jeton de la session ouverte. Faux si rien n'a pu être gardé (alors on révoque normalement). */
export async function parkCurrentSession(userId: string): Promise<boolean> {
  const tokens = Session.getTokens();
  if (!tokens) return false;
  try {
    await parkSession(userId, tokens);
    useDeviceAccountsStore.getState().setSecrets(userId, { savedSession: true });
    return true;
  } catch {
    return false;
  }
}

/** Enregistre le mot de passe tapé à la connexion (case cochée par l'utilisateur). Faux si le coffre a refusé. */
export async function rememberPassword(userId: string, password: string): Promise<boolean> {
  try {
    await savePassword(userId, password);
    useDeviceAccountsStore.getState().setSecrets(userId, { savedPassword: true });
    return true;
  } catch {
    return false;
  }
}

/** Retire seulement le mot de passe enregistré (le compte et la reconnexion par jeton restent). */
export async function forgetSavedPassword(userId: string): Promise<void> {
  await deletePassword(userId);
  secretsOf(userId).clearPassword();
}

/**
 * Changement de compte SANS déconnexion : le compte courant est mis de côté (jeton gardé, non révoqué), puis la session du
 * compte choisi est ouverte (jeton gardé, sinon mot de passe enregistré).
 *
 * Deux précautions, parce qu'un jeton ne doit jamais exister en deux exemplaires vivants (le serveur le renouvelle à
 * chaque emploi ; l'ancien exemplaire, réutilisé, ferait révoquer toute la famille de jetons) :
 *  - le courant est mis de côté AVANT d'ouvrir l'autre session, qui le remplacerait en mémoire ;
 *  - si l'ouverture échoue (annulation, hors ligne, refus), la mise de côté est défaite et la session courante continue.
 */
export async function switchAccount(target: DeviceAccount, current: AuthenticatedUser): Promise<QuickSignInResult> {
  let parked = false;
  let cleaned = false;
  const result = await quickSignIn(target, {
    beforeOpen: async () => {
      parked = await parkCurrentSession(current.id);
      if (!parked) return false;
      rememberAccount(current); // il doit figurer dans la liste pour qu'on puisse y revenir d'un toucher
      await runBeforeLogout(); // retire l'appareil des notifications du compte qu'on quitte
      cleaned = true;
      return true;
    },
  });
  if (result.status !== "ok" && parked) {
    await deleteParkedSession(current.id);
    useDeviceAccountsStore.getState().setSecrets(current.id, { savedSession: false });
    // Les notifications avaient été retirées du compte courant, qui reste ouvert : on les lui remet.
    if (cleaned) void registerForPush();
  }
  return result;
}

/**
 * « Ajouter un compte » : met le compte courant de côté (non révoqué) pour qu'on puisse y revenir d'un toucher, sans quoi
 * la déconnexion le révoquerait. Faux si rien n'a pu être gardé ; l'appelant se déconnecte alors normalement.
 */
export async function parkForAddAccount(current: AuthenticatedUser): Promise<boolean> {
  const parked = await parkCurrentSession(current.id);
  if (parked) rememberAccount(current);
  return parked;
}

/**
 * Révoque d'un coup toutes les connexions gardées de CET appareil : chaque jeton parqué est révoqué côté serveur et chaque
 * mot de passe enregistré est effacé. Les comptes restent dans la liste (e-mail prérempli), sans reconnexion rapide.
 * Au mieux côté serveur : hors ligne, un jeton non révoqué expire de lui-même (30 jours) mais n'est plus lisible ici.
 */
export async function revokeAllQuickSignIns(): Promise<number> {
  const accounts = useDeviceAccountsStore.getState().accounts.filter((a) => a.savedSession || a.savedPassword);
  await Promise.all(accounts.map((a) => wipeSecrets(a.id)));
  return accounts.length;
}
