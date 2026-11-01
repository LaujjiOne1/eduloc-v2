// Lancer : node --test supabase/functions/_shared/odoo-mapping.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ATTEMPTS,
  backoffMinutes,
  buildOdooPayload,
  classifyStatus,
  externalReference,
  nextAttemptAt,
  publicReference,
  truncateError,
} from "./odoo-mapping.ts";

const ID = "a1b2c3d4-0000-4000-8000-123456789abc";
const row = {
  id: ID,
  created_at: "2026-10-30T09:15:00+00:00",
  category: "cours_proche",
  details: { pour: "Mon enfant", niveau: "Collège", matiere: "Anglais", ville: "  ", vide: "", nombre: 3 },
  full_name: "Awa Diallo",
  phone: "06 12 34 56 78",
  email: null,
  preferred_channel: "WhatsApp",
  message: null,
};

test("références : externe stable et publique identique à celle montrée au visiteur", () => {
  assert.equal(externalReference(ID), `EDULOC-SUPPORT-${ID}`);
  assert.equal(publicReference(ID), "A1B2C3D4");
  assert.equal(publicReference(ID), ID.slice(0, 8).toUpperCase());
});

test("payload : champs nuls en chaîne vide, détails non textuels ou vides écartés", () => {
  const payload = buildOdooPayload(row);
  assert.equal(payload.external_reference, `EDULOC-SUPPORT-${ID}`);
  assert.equal(payload.received_at, row.created_at);
  assert.equal(payload.email, "");
  assert.equal(payload.message, "");
  assert.deepEqual(payload.details, { pour: "Mon enfant", niveau: "Collège", matiere: "Anglais" });
});

test("payload : détails absents", () => {
  assert.deepEqual(buildOdooPayload({ ...row, details: null }).details, {});
});

test("classification des réponses Odoo", () => {
  assert.equal(classifyStatus(201).kind, "success");
  assert.equal(classifyStatus(200).kind, "success");
  for (const status of [400, 413, 422]) assert.equal(classifyStatus(status).kind, "permanent", String(status));
  for (const status of [401, 404, 429, 500, 502, 503, 504]) assert.equal(classifyStatus(status).kind, "retry", String(status));
});

test("délais de reprise progressifs puis plafonnés", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 9].map(backoffMinutes), [1, 5, 15, 60, 180, 720, 720, 720]);
  assert.equal(backoffMinutes(0), 1);
});

test("la reprise automatique s'arrête après MAX_ATTEMPTS", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  assert.equal(nextAttemptAt(1, now)?.toISOString(), "2026-10-30T10:01:00.000Z");
  assert.ok(nextAttemptAt(MAX_ATTEMPTS - 1, now));
  assert.equal(nextAttemptAt(MAX_ATTEMPTS, now), null);
});

test("messages d'erreur tronqués", () => {
  assert.equal(truncateError("court"), "court");
  assert.equal(truncateError("x".repeat(1500)).length, 1001);
});
