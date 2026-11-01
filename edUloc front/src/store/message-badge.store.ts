import { create } from "zustand";

interface MessageBadgeState {
  /** Total des messages non lus, toutes conversations confondues (pastille de l'onglet Messages). */
  unread: number;
  setUnread: (unread: number) => void;
}

export const useMessageBadgeStore = create<MessageBadgeState>((set) => ({
  unread: 0,
  setUnread: (unread) => set({ unread }),
}));
