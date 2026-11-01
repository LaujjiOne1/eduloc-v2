import { create } from "zustand";

interface SignOutPromptStore {
  visible: boolean;
  open: () => void;
  close: () => void;
}

/** Ouverture de la feuille « Se déconnecter ? » (montée une seule fois à la racine, voir SignOutPrompt). */
export const useSignOutPromptStore = create<SignOutPromptStore>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
