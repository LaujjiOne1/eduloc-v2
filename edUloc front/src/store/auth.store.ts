import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { AuthService } from "@/services/auth.service";
import type { AuthenticatedUser } from "@/types/auth";

// Expo Router statically renders routes on the server (Node) during web
// export/SSR, where `window` doesn't exist — AsyncStorage's web shim reaches
// for `window.localStorage` and crashes if touched there. `window` is always
// defined at runtime (browser or React Native), so this only no-ops on the
// server, and rehydrates normally once the client takes over.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const authStorage = () => (typeof window === "undefined" ? noopStorage : AsyncStorage);

/** Which dashboard the signed-in user is currently operating as — set by 37_ModeChoice / 36_ModeSwitch. */
export type UserMode = "apprenti" | "tutor";

interface AuthStore {
  /** The signed-in, verified user — null means "not authenticated". */
  user: AuthenticatedUser | null;
  /** Set right after signup succeeds, before the email is verified. */
  pendingUser: AuthenticatedUser | null;
  /** True once AsyncStorage rehydration has run, so screens can avoid a flash of "logged out". */
  hasHydrated: boolean;
  /**
   * No role/approval model exists on AuthenticatedUser yet (AGENTS.md §8) —
   * this only remembers which of the two dashboards 36_ModeSwitch/37_ModeChoice
   * last sent the user to, so ModeSwitch can show the correct mode as active.
   * It does not gate access to either dashboard.
   */
  activeMode: UserMode;
  /**
   * Where to send the user after a successful login/signup+verify, when they
   * were detoured through auth from somewhere other than the booking flow's
   * default (e.g. the tutor-onboarding wizard). Null means "use the default
   * destination that screen already hardcodes" — transient, not persisted.
   */
  returnTo: Href | null;
  /**
   * « Rester connecté » : vrai (par défaut), la session est conservée sur l'appareil ; faux, elle prend fin à la fermeture
   * de l'application. C'est le dernier choix fait à la connexion, qui le propose de nouveau tel quel.
   */
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  /**
   * Compteur incrémenté à chaque changement de compte sans déconnexion : la racine de l'application s'en sert comme clé
   * pour repartir à neuf (aucun écran, aucune donnée du compte précédent ne survit). Jamais persisté.
   */
  accountEpoch: number;
  bumpAccountEpoch: () => void;
  setUser: (user: AuthenticatedUser) => void;
  setPendingUser: (user: AuthenticatedUser) => void;
  clearPendingUser: () => void;
  /** Promotes pendingUser to user once the verification code is confirmed. */
  confirmPendingUser: () => void;
  setActiveMode: (mode: UserMode) => void;
  setReturnTo: (route: Href | null) => void;
  /** `revokeSession: false` : le jeton a été mis de côté dans le coffre de l'appareil, on ne le révoque pas. */
  logout: (options?: { revokeSession?: boolean }) => void;
  /** La session a été perdue côté serveur (refresh refusé) : on vide l'UI sans rappeler /auth/logout. */
  sessionLost: () => void;
}

/**
 * The single source of truth for "is anyone logged in", used by the BookDate
 * auth gate to decide whether to route straight to Beneficiary or detour
 * through Login. Persisted (user only) so a returning user doesn't have to
 * log in again on every app launch.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      pendingUser: null,
      hasHydrated: false,
      activeMode: "apprenti",
      returnTo: null,
      rememberMe: true,
      accountEpoch: 0,

      setRememberMe: (rememberMe) => set({ rememberMe }),
      bumpAccountEpoch: () => set((s) => ({ accountEpoch: s.accountEpoch + 1 })),

      setUser: (user) => set({ user, pendingUser: null }),

      setPendingUser: (pendingUser) => set({ pendingUser }),
      clearPendingUser: () => set({ pendingUser: null }),

      confirmPendingUser: () =>
        set((s) => ({ user: s.pendingUser ?? s.user, pendingUser: null })),

      setActiveMode: (activeMode) => set({ activeMode }),

      setReturnTo: (returnTo) => set({ returnTo }),

      sessionLost: () => set({ user: null, pendingUser: null, activeMode: "apprenti" }),

      logout: (options) => {
        // Best-effort: revoke the refresh token server-side, but never block
        // the local sign-out on a network failure.
        AuthService.logout({ revoke: options?.revokeSession }).catch(() => undefined);
        set({ user: null, pendingUser: null, activeMode: "apprenti", returnTo: null });
      },
    }),
    {
      name: "eduloc-auth",
      storage: createJSONStorage(authStorage),
      // Sans « rester connecté », rien de l'utilisateur n'est écrit sur l'appareil.
      partialize: (state) => ({
        user: state.rememberMe ? state.user : null,
        activeMode: state.rememberMe ? state.activeMode : "apprenti",
        rememberMe: state.rememberMe,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
