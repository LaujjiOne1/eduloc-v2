// Passerelle site vitrine -> Odoo (cahier "odoo integration.md", §5.2 et §6).
//
// Appelée chaque minute par la tâche planifiée (en-tête Authorization: Bearer LOVABLE_CRON_SECRET), elle
// transmet à Odoo les demandes dont la ligne odoo_sync_logs est PENDING ou FAILED et dont la prochaine
// tentative est échue. Le formulaire du site n'en dépend pas : une demande est déjà enregistrée.
//
// Reprise manuelle d'un administrateur (même secret) :
//   POST { "support_request_id": "<uuid>" }  -> retente cette demande immédiatement, même si le plafond
//                                                de tentatives automatiques est atteint.
//
// Secrets requis : ODOO_URL (ex. https://crm.example.com), ODOO_API_TOKEN (= EDULOC_API_TOKEN côté Odoo).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import type { SupportRequestRow } from "../_shared/odoo-mapping.ts";
import { attemptSync, odooHttpClient, type SyncLog } from "../_shared/odoo-sync.ts";

const BATCH_SIZE = 20;
// Réservation d'une ligne pendant son traitement : évite qu'une exécution concurrente la reprenne.
const LEASE_MS = 3 * 60_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  const denied = authenticateCronRequest(request);
  if (denied) return denied;

  const odooUrl = Deno.env.get("ODOO_URL");
  const odooToken = Deno.env.get("ODOO_API_TOKEN");
  if (!odooUrl || !odooToken) return json(500, { error: "ODOO_URL et ODOO_API_TOKEN doivent être définis." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const post = odooHttpClient(odooUrl, odooToken);
  const now = new Date();

  let forcedId: string | null = null;
  if (request.method === "POST") {
    try {
      forcedId = (await request.json())?.support_request_id ?? null;
    } catch {
      // Corps absent ou vide : exécution planifiée normale.
    }
  }

  const columns = "id, support_request_id, external_reference, attempt_count, next_attempt_at";
  const query = db.from("odoo_sync_logs").select(columns).in("sync_status", ["PENDING", "FAILED"]);
  const { data: logs, error } = forcedId
    ? await query.eq("support_request_id", forcedId)
    : await query.lte("next_attempt_at", now.toISOString()).order("next_attempt_at").limit(BATCH_SIZE);
  if (error) return json(500, { error: error.message });

  const summary = { processed: 0, success: 0, failed: 0, skipped: 0 };
  for (const row of logs ?? []) {
    // Réservation atomique : ne réussit que si personne d'autre n'a modifié next_attempt_at entre-temps.
    const lease = new Date(now.getTime() + LEASE_MS).toISOString();
    const claim = db.from("odoo_sync_logs").update({ next_attempt_at: lease }).eq("id", row.id);
    const { data: claimed } = await (row.next_attempt_at === null ? claim.is("next_attempt_at", null) : claim.eq("next_attempt_at", row.next_attempt_at)).select("id");
    if (!claimed?.length) {
      summary.skipped++;
      continue;
    }

    const { data: supportRequest, error: loadError } = await db
      .from("support_requests")
      .select("id, created_at, category, details, full_name, phone, email, preferred_channel, message")
      .eq("id", row.support_request_id)
      .single();
    if (loadError || !supportRequest) {
      await db.from("odoo_sync_logs").update({ sync_status: "FAILED", last_error: `Demande introuvable : ${loadError?.message}`, next_attempt_at: null }).eq("id", row.id);
      summary.failed++;
      continue;
    }

    const patch = await attemptSync(row as SyncLog, supportRequest as SupportRequestRow, post);
    const { error: saveError } = await db.from("odoo_sync_logs").update(patch).eq("id", row.id);
    if (saveError) console.error(`odoo-sync: écriture du journal impossible (${row.id})`, saveError.message);
    summary.processed++;
    if (patch.sync_status === "SUCCESS") {
      summary.success++;
    } else {
      summary.failed++;
      console.error(`odoo-sync: ${row.external_reference} — ${patch.last_error}`);
    }
  }
  return json(200, summary);
});
