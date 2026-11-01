import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthTokensDto } from "@/api/contracts/dto";
import { t } from "@/i18n";

/**
 * Coffre des secrets de CET appareil : keystore Android / trousseau iOS (expo-secure-store), jamais AsyncStorage.
 *  - un jeton de rafraîchissement « parqué » à la déconnexion, pour se reconnecter d'un toucher ;
 *  - un mot de passe que l'utilisateur a choisi d'enregistrer.
 *
 * Garde-fous :
 *  - rien n'est stocké si l'appareil n'a ni empreinte, ni visage, ni code de verrouillage (`isVaultAvailable`) ;
 *  - toute lecture exige d'abord un déverrouillage (`unlockVault`) ;
 *  - iOS : accessible seulement appareil déverrouillé avec un code défini, sans migration vers un autre appareil.
 * Limite connue : sur Android la clé du keystore n'est pas liée à l'empreinte, c'est l'application qui exige le
 * déverrouillage avant de lire. Un appareil « rooté » reste hors de portée de cette protection.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY };

// Clés autorisées : lettres, chiffres, « . », « - », « _ » (un identifiant UUID convient).
const sessionKey = (accountId: string) => `eduloc.vault.session.${accountId}`;
const passwordKey = (accountId: string) => `eduloc.vault.password.${accountId}`;

/** Jeton de rafraîchissement mis de côté pour un compte. À usage unique : le serveur le renouvelle à chaque emploi. */
export interface ParkedSession {
  refreshToken: string;
  refreshExpiresAt: string | null;
}

export async function isVaultAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    if (!(await SecureStore.isAvailableAsync())) return false;
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Demande l'empreinte, le visage ou le code de l'appareil. Faux si l'utilisateur annule ou échoue. */
export async function unlockVault(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: t("common.cancel") });
    return result.success;
  } catch {
    return false;
  }
}

export async function parkSession(accountId: string, tokens: AuthTokensDto): Promise<void> {
  const value: ParkedSession = { refreshToken: tokens.refreshToken, refreshExpiresAt: tokens.refreshExpiresAt ?? tokens.expiresAt ?? null };
  await SecureStore.setItemAsync(sessionKey(accountId), JSON.stringify(value), OPTIONS);
}

/** Lecture seule (la suppression est séparée : on ne perd pas le jeton si le réseau a échoué entre-temps). */
export async function readParkedSession(accountId: string): Promise<ParkedSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(accountId), OPTIONS);
    return raw ? (JSON.parse(raw) as ParkedSession) : null;
  } catch {
    return null;
  }
}

export async function deleteParkedSession(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey(accountId), OPTIONS).catch(() => undefined);
}

export async function savePassword(accountId: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(passwordKey(accountId), password, OPTIONS);
}

export async function readPassword(accountId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(passwordKey(accountId), OPTIONS);
  } catch {
    return null;
  }
}

export async function deletePassword(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(passwordKey(accountId), OPTIONS).catch(() => undefined);
}
