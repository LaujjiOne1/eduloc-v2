import { create } from "zustand";

interface SwitchAccountPromptStore {
  visible: boolean;
  open: () => void;
  close: () => void;
}

/** Ouverture de la feuille « Changer de compte » (montée une seule fois à la racine, voir SwitchAccountSheet). */
export const useSwitchAccountPromptStore = create<SwitchAccountPromptStore>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));

/** Point d'entrée des boutons « Changer de compte ». */
export const requestSwitchAccount = (): void => useSwitchAccountPromptStore.getState().open();
