// Logique pure de la passerelle site -> Odoo (sans accès réseau ni base), testable avec Node et Deno.
// Contrat d'API : voir odoo/README.md et odoo/addons/eduloc_integration/controllers/support_request.py.

export type SupportRequestRow = {
  id: string;
  created_at: string;
  category: string;
  details: Record<string, unknown> | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  message: string | null;
};

export type OdooPayload = {
  external_reference: string;
  public_reference: string;
  received_at: string;
  category: string;
  full_name: string;
  phone: string;
  email: string;
  preferred_channel: string;
  message: string;
  details: Record<string, string>;
};

export const EXTERNAL_REFERENCE_PREFIX = "EDULOC-SUPPORT-";

export const externalReference = (supportRequestId: string) => `${EXTERNAL_REFERENCE_PREFIX}${supportRequestId}`;

// Même règle que GuidedAssistant.tsx (référence montrée au visiteur) : l'agent doit pouvoir la retrouver dans Odoo.
export const publicReference = (supportRequestId: string) => supportRequestId.slice(0, 8).toUpperCase();

export function buildOdooPayload(row: SupportRequestRow): OdooPayload {
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.details ?? {})) {
    if (typeof value === "string" && value.trim() !== "") details[key] = value.trim();
  }
  return {
    external_reference: externalReference(row.id),
    public_reference: publicReference(row.id),
    received_at: row.created_at,
    category: row.category,
    full_name: row.full_name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    preferred_channel: row.preferred_channel ?? "",
    message: row.message ?? "",
    details,
  };
}

export type Outcome =
  | { kind: "success" }
  // Odoo est joignable mais refuse la demande telle quelle : réessayer ne changera rien.
  | { kind: "permanent"; reason: string }
  // Indisponibilité, mauvaise configuration, surcharge : une reprise ultérieure peut aboutir.
  | { kind: "retry"; reason: string };

export function classifyStatus(status: number): Outcome {
  if (status === 200 || status === 201) return { kind: "success" };
  if (status === 400 || status === 413 || status === 422) return { kind: "permanent", reason: `HTTP ${status}` };
  return { kind: "retry", reason: `HTTP ${status}` };
}

// 1 min, 5 min, 15 min, 1 h, 3 h, 12 h puis 12 h ; au-delà de MAX_ATTEMPTS la reprise devient manuelle.
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 720];
export const MAX_ATTEMPTS = 10;

export function backoffMinutes(attemptCount: number): number {
  return BACKOFF_MINUTES[Math.min(Math.max(attemptCount, 1), BACKOFF_MINUTES.length) - 1];
}

/** Date de la prochaine tentative automatique après un échec, ou null si la reprise doit être manuelle. */
export function nextAttemptAt(attemptCount: number, now: Date): Date | null {
  if (attemptCount >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + backoffMinutes(attemptCount) * 60_000);
}

export function truncateError(message: string, max = 1000): string {
  return message.length > max ? `${message.slice(0, max)}…` : message;
}
