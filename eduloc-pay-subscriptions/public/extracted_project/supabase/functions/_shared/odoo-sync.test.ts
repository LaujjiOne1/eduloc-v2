// Lancer : node --test supabase/functions/_shared/odoo-sync.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { OdooPayload } from "./odoo-mapping.ts";
import { attemptSync, type PostToOdoo, type SyncLog } from "./odoo-sync.ts";

const ID = "a1b2c3d4-0000-4000-8000-123456789abc";
const log: SyncLog = { id: "log-1", support_request_id: ID, external_reference: `EDULOC-SUPPORT-${ID}`, attempt_count: 0 };
const request = {
  id: ID,
  created_at: "2026-10-30T09:15:00+00:00",
  category: "trouver_tuteur",
  details: { niveau: "Lycée" },
  full_name: "Awa Diallo",
  phone: null,
  email: "awa@example.com",
  preferred_channel: "E-mail",
  message: null,
};
const now = new Date("2026-10-30T10:00:00Z");
const reply = (status: number, body: unknown): PostToOdoo => async () => ({ status, body });

test("succès : identifiants Odoo conservés, plus de reprise", async () => {
  const patch = await attemptSync(log, request, reply(201, { status: "created", lead_id: 42, partner_id: 7, external_reference: log.external_reference }), now);
  assert.deepEqual(patch, {
    sync_status: "SUCCESS",
    attempt_count: 1,
    last_error: null,
    last_attempt_at: now.toISOString(),
    next_attempt_at: null,
    synced_at: now.toISOString(),
    odoo_lead_id: 42,
    odoo_partner_id: 7,
  });
});

test("rejeu : une piste « existing » compte comme un succès", async () => {
  const patch = await attemptSync(log, request, reply(200, { status: "existing", lead_id: 42, partner_id: null, external_reference: log.external_reference }), now);
  assert.equal(patch.sync_status, "SUCCESS");
  assert.equal(patch.odoo_partner_id, undefined);
});

test("le payload envoyé contient la référence externe et les détails", async () => {
  let sent: OdooPayload | undefined;
  await attemptSync(log, request, async (payload) => { sent = payload; return { status: 201, body: { lead_id: 1, external_reference: log.external_reference } }; }, now);
  assert.equal(sent?.external_reference, log.external_reference);
  assert.deepEqual(sent?.details, { niveau: "Lycée" });
});

test("Odoo injoignable : échec avec reprise dans 1 minute, demande jamais supprimée", async () => {
  const patch = await attemptSync(log, request, async () => { throw new TypeError("fetch failed"); }, now);
  assert.equal(patch.sync_status, "FAILED");
  assert.match(patch.last_error!, /injoignable.*fetch failed/);
  assert.equal(patch.next_attempt_at, "2026-10-30T10:01:00.000Z");
});

test("erreur d'authentification : échec avec reprise (configuration à corriger)", async () => {
  const patch = await attemptSync(log, request, reply(401, { error: { code: "unauthorized", message: "Jeton d'API invalide." } }), now);
  assert.equal(patch.sync_status, "FAILED");
  assert.match(patch.last_error!, /HTTP 401 — Jeton d'API invalide/);
  assert.ok(patch.next_attempt_at);
});

test("données invalides : échec définitif, visible, sans reprise automatique", async () => {
  const patch = await attemptSync(log, request, reply(422, { error: { code: "invalid_payload", message: "Adresse e-mail invalide." } }), now);
  assert.equal(patch.sync_status, "FAILED");
  assert.equal(patch.next_attempt_at, null);
  assert.match(patch.last_error!, /Adresse e-mail invalide/);
});

test("réponse non JSON d'un proxy : reprise", async () => {
  const patch = await attemptSync(log, request, reply(502, "<html>Bad Gateway</html>"), now);
  assert.equal(patch.sync_status, "FAILED");
  assert.ok(patch.next_attempt_at);
  assert.match(patch.last_error!, /Bad Gateway/);
});

test("réponse 2xx avec une autre référence : traitée comme un échec", async () => {
  const patch = await attemptSync(log, request, reply(201, { lead_id: 1, external_reference: "EDULOC-SUPPORT-autre" }), now);
  assert.equal(patch.sync_status, "FAILED");
  assert.match(patch.last_error!, /inattendue/);
});

test("le compteur progresse et la reprise devient manuelle après 10 tentatives", async () => {
  const down = async () => { throw new Error("down"); };
  const patch = await attemptSync({ ...log, attempt_count: 9 }, request, down, now);
  assert.equal(patch.attempt_count, 10);
  assert.equal(patch.next_attempt_at, null);
});
