import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { AuthenticatedUser } from "@/types/auth";

// Même garde que auth.store : le rendu serveur d'Expo Router n'a pas de `window`, où AsyncStorage échouerait.
const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const deviceStorage = () => (typeof window === "undefined" ? noopStorage : AsyncStorage);

/** Au-delà, le compte le moins récemment utilisé est oublié : la liste reste lisible d'un coup d'œil. */
const MAX_ACCOUNTS = 4;

/**
 * Un compte « connu » de cet appareil. Ce store ne contient QUE de l'identité et deux indicateurs : les secrets eux-mêmes
 * (jeton de reconnexion, mot de passe) vivent dans le coffre sécurisé (lib/device-vault), jamais ici.
 */
export interface DeviceAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lastUsedAt: number;
  /** Un jeton de reconnexion est parqué dans le coffre : reconnexion d'un toucher, sans mot de passe. */
  savedSession: boolean;
  /** Un mot de passe est enregistré dans le coffre (déverrouillé par l'empreinte, le visage ou le code). */
  savedPassword: boolean;
}

interface DeviceAccountsStore {
  accounts: DeviceAccount[];
  /** Mémorise (ou remet en tête) le compte qui vient de se connecter ; les indicateurs existants sont conservés. */
  remember: (user: Pick<AuthenticatedUser, "id" | "firstName" | "lastName" | "email">) => void;
  /** Met à jour les indicateurs du coffre pour un compte déjà mémorisé. */
  setSecrets: (id: string, secrets: Partial<Pick<DeviceAccount, "savedSession" | "savedPassword">>) => void;
  /** « Oublier ce compte sur cet appareil » (le coffre se vide via lib/device-login). */
  forget: (id: string) => void;
}

/** Comptes proposés sur l'écran de connexion et au moment de se déconnecter. Persisté localement, jamais envoyé au serveur. */
export const useDeviceAccountsStore = create<DeviceAccountsStore>()(
  persist(
    (set) => ({
      accounts: [],

      remember: (user) =>
        set((s) => {
          const previous = s.accounts.find((a) => a.id === user.id);
          const entry: DeviceAccount = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            lastUsedAt: Date.now(),
            savedSession: previous?.savedSession ?? false,
            savedPassword: previous?.savedPassword ?? false,
          };
          return { accounts: [entry, ...s.accounts.filter((a) => a.id !== user.id)].slice(0, MAX_ACCOUNTS) };
        }),

      setSecrets: (id, secrets) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...secrets } : a)) })),

      forget: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
    }),
    { name: "eduloc-device-accounts", storage: createJSONStorage(deviceStorage) },
  ),
);
