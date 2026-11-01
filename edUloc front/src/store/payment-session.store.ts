import { create } from "zustand";

/** Paiement en cours d'ouverture dans la WebView : l'adresse (jeton signé dans son fragment) ne passe jamais dans l'URL de l'écran. */
export interface PaymentSession {
  paymentId: string;
  bookingId: string;
  checkoutUrl: string;
  amountLabel: string;
}

interface PaymentSessionStore {
  session: PaymentSession | null;
  open: (session: PaymentSession) => void;
  clear: () => void;
}

export const usePaymentSessionStore = create<PaymentSessionStore>((set) => ({
  session: null,
  open: (session) => set({ session }),
  clear: () => set({ session: null }),
}));
