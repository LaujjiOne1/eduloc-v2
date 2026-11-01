/**
 * Appels de la page de paiement vers SON serveur (même origine). Le ticket signé par EduLoc accompagne chaque appel : c'est lui,
 * et lui seul, qui dit quel paiement et quel montant. Rien n'est écrit dans localStorage ni ailleurs dans le navigateur.
 */
export type PaymentState = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface SessionInfo {
  payment: { id: string; reservationId: string; amount: string; currency: string; description: string; customerName: string; returnUrl: string };
  state: PaymentState;
  methods: { visa: { publishableKey: string } | null; mobileMoney: string[] };
}

export class CheckoutError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/** Le ticket est dans le FRAGMENT de l'adresse (`#ticket=…`) : jamais envoyé au serveur web, jamais dans ses journaux. */
export function readTicket(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('ticket');
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/checkout/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new CheckoutError('Connexion impossible. Vérifiez votre réseau puis réessayez.', 'network');
  }
  const json = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) throw new CheckoutError(json?.error?.message ?? 'Une erreur est survenue.', json?.error?.code ?? 'error');
  return json as T;
}

export const checkoutApi = {
  session: (ticket: string) => post<SessionInfo>('session', { ticket }),
  startCard: (ticket: string) => post<{ alreadyPaid: true } | { clientSecret: string; publishableKey: string }>('card', { ticket }),
  startMobileMoney: (ticket: string, operator: string, phone: string) => post<{ state: PaymentState } | { alreadyPaid: true }>('mobile-money', { ticket, operator, phone }),
  status: (ticket: string) => post<{ state: PaymentState }>('status', { ticket }),
};

/** « 47 000 Ar » (l'ariary n'a pas de centimes). */
export function formatAmount(amount: string, currency: string): string {
  const value = Number(amount);
  return currency === 'MGA'
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value).replace(/ | /g, ' ')} Ar`
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value);
}

/**
 * À la fin du parcours : prévient l'application (WebView) puis retourne à son adresse. Ni l'un ni l'autre ne prouvent un
 * paiement : l'application relit le statut auprès du backend EduLoc (SEC-06).
 */
export function returnToApp(returnUrl: string, paymentId: string): void {
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage(message: string): void } }).ReactNativeWebView;
  bridge?.postMessage(JSON.stringify({ type: 'eduloc:payment:done', payment: paymentId }));
  window.location.href = returnUrl;
}

/** Stripe.js se charge depuis Stripe (jamais copié chez nous) : c'est lui qui reçoit le numéro de carte, pas cette page. */
export function loadStripe(publishableKey: string): Promise<any> {
  const w = window as unknown as { Stripe?: (key: string) => any };
  if (w.Stripe) return Promise.resolve(w.Stripe(publishableKey));
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => (w.Stripe ? resolve(w.Stripe(publishableKey)) : reject(new CheckoutError('Stripe est indisponible.', 'stripe')));
    script.onerror = () => reject(new CheckoutError('Impossible de charger le module de paiement par carte.', 'stripe'));
    document.head.appendChild(script);
  });
}
