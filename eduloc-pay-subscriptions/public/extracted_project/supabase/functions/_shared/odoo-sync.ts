// Une tentative de transmission d'une demande du site vers Odoo. Aucune dépendance Deno/Supabase :
// le client HTTP est injecté, ce qui permet de tester tous les scénarios d'échec.
import {
  type OdooPayload,
  type SupportRequestRow,
  buildOdooPayload,
  classifyStatus,
  nextAttemptAt,
  truncateError,
} from "./odoo-mapping.ts";

export type SyncLog = {
  id: string;
  support_request_id: string;
  external_reference: string;
  attempt_count: number;
};

export type LogPatch = {
  sync_status: "SUCCESS" | "FAILED";
  attempt_count: number;
  last_error: string | null;
  last_attempt_at: string;
  next_attempt_at: string | null;
  synced_at?: string;
  odoo_lead_id?: number;
  odoo_partner_id?: number;
};

export type OdooResponse = { status: number; body: unknown };
export type PostToOdoo = (payload: OdooPayload) => Promise<OdooResponse>;

export const ODOO_ENDPOINT_PATH = "/eduloc/api/v1/support-requests";

export function odooHttpClient(baseUrl: string, token: string, timeoutMs = 15_000): PostToOdoo {
  const url = `${baseUrl.replace(/\/+$/, "")}${ODOO_ENDPOINT_PATH}`;
  return async (payload) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Réponse non JSON (page d'erreur d'un proxy, par exemple) : on garde le texte brut.
    }
    return { status: response.status, body };
  };
}

function describeFailure(reason: string, body: unknown): string {
  const apiMessage = (body as { error?: { message?: string } } | null)?.error?.message;
  return truncateError(apiMessage ? `${reason} — ${apiMessage}` : `${reason} — ${typeof body === "string" ? body : JSON.stringify(body)}`);
}

export async function attemptSync(
  log: SyncLog,
  request: SupportRequestRow,
  post: PostToOdoo,
  now: Date = new Date(),
): Promise<LogPatch> {
  const attempt = log.attempt_count + 1;
  const base = { attempt_count: attempt, last_attempt_at: now.toISOString() };
  const failed = (error: string, retryable: boolean): LogPatch => ({
    ...base,
    sync_status: "FAILED",
    last_error: error,
    next_attempt_at: retryable ? (nextAttemptAt(attempt, now)?.toISOString() ?? null) : null,
  });

  let response: OdooResponse;
  try {
    response = await post(buildOdooPayload(request));
  } catch (error) {
    return failed(truncateError(`Odoo injoignable : ${error instanceof Error ? error.message : String(error)}`), true);
  }

  const outcome = classifyStatus(response.status);
  if (outcome.kind !== "success") {
    return failed(describeFailure(outcome.reason, response.body), outcome.kind === "retry");
  }

  const body = response.body as { lead_id?: unknown; partner_id?: unknown; external_reference?: unknown };
  if (typeof body?.lead_id !== "number" || body.external_reference !== log.external_reference) {
    return failed(describeFailure("Réponse Odoo inattendue", response.body), true);
  }
  return {
    ...base,
    sync_status: "SUCCESS",
    last_error: null,
    next_attempt_at: null,
    synced_at: now.toISOString(),
    odoo_lead_id: body.lead_id,
    ...(typeof body.partner_id === "number" ? { odoo_partner_id: body.partner_id } : {}),
  };
}
