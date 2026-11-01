from odoo.tests import TransactionCase, tagged

from ..models.res_partner import phone_key
from ..models.support_intake import IntakeError


def make_payload(**overrides):
    payload = {
        "external_reference": "EDULOC-SUPPORT-11111111-2222-3333-4444-555555555555",
        "public_reference": "11111111",
        "received_at": "2026-10-30T09:15:00+00:00",
        "category": "trouver_tuteur",
        "full_name": "Awa Diallo",
        "phone": "06 12 34 56 78",
        "email": "Awa.Diallo@Example.com",
        "preferred_channel": "WhatsApp",
        "message": "Disponible le mercredi.\nMerci !",
        "details": {
            "niveau": "Lycée",
            "matiere": "Mathématiques",
            "format": "En ligne",
            "frequence": "1×/semaine",
            "ville": "Lyon 3e",
        },
    }
    payload.update(overrides)
    return payload


@tagged("post_install", "-at_install")
class TestSupportIntake(TransactionCase):
    def setUp(self):
        super().setUp()
        self.intake = self.env["eduloc.support.intake"].sudo()
        self.Lead = self.env["crm.lead"]
        self.Partner = self.env["res.partner"]

    def ingest(self, **overrides):
        return self.intake.ingest(make_payload(**overrides))

    def test_creates_partner_and_lead_with_mapped_fields(self):
        result = self.ingest()
        self.assertEqual(result["status"], "created")
        lead = self.Lead.browse(result["lead_id"])
        self.assertEqual(lead.partner_id.id, result["partner_id"])
        self.assertEqual(lead.partner_id.email_normalized, "awa.diallo@example.com")
        self.assertEqual(lead.email_from, "awa.diallo@example.com")
        self.assertEqual(lead.phone, "06 12 34 56 78")
        self.assertIn("Coordonnées saisies sur le site", lead.description)
        self.assertEqual(lead.eduloc_external_ref, "EDULOC-SUPPORT-11111111-2222-3333-4444-555555555555")
        self.assertEqual(lead.eduloc_public_ref, "11111111")
        self.assertEqual(lead.eduloc_request_type, "trouver_tuteur")
        self.assertEqual(lead.eduloc_level, "Lycée")
        self.assertEqual(lead.eduloc_subject, "Mathématiques")
        self.assertEqual(lead.eduloc_format, "En ligne")
        self.assertEqual(lead.eduloc_frequency, "1×/semaine")
        self.assertEqual(lead.eduloc_city, "Lyon 3e")
        self.assertEqual(lead.eduloc_preferred_channel, "WhatsApp")
        self.assertEqual(str(lead.eduloc_received_at), "2026-10-30 09:15:00")
        self.assertIn("[11111111]", lead.name)
        self.assertIn("Disponible le mercredi.", lead.description)
        self.assertEqual(lead.stage_id, self.env.ref("eduloc_integration.stage_new_request"))
        self.assertEqual(lead.team_id, self.env.ref("eduloc_integration.team_eduloc"))
        self.assertEqual(lead.source_id, self.env.ref("eduloc_integration.utm_source_website"))
        self.assertEqual(lead.tag_ids, self.env.ref("eduloc_integration.tag_trouver_tuteur"))
        self.assertFalse(lead.user_id, "La piste doit rester non assignée, pas attribuée au compte technique.")
        self.assertEqual(lead.type, "opportunity")

    def test_repeated_submission_is_idempotent(self):
        first = self.ingest()
        before = self.Lead.search_count([])
        again = self.ingest()
        self.assertEqual(again["status"], "existing")
        self.assertEqual(again["lead_id"], first["lead_id"])
        self.assertEqual(self.Lead.search_count([]), before)

    def test_idempotence_survives_assignment_to_an_agent(self):
        first = self.ingest()
        agent = self.env["res.users"].create(
            {
                "name": "Agent Test",
                "login": "agent.test",
                "group_ids": [(6, 0, [self.env.ref("sales_team.group_sale_salesman").id])],
            }
        )
        self.Lead.browse(first["lead_id"]).user_id = agent
        again = self.ingest()
        self.assertEqual(again["status"], "existing")
        self.assertEqual(again["lead_id"], first["lead_id"])

    def test_idempotence_covers_archived_leads(self):
        first = self.ingest()
        self.Lead.browse(first["lead_id"]).action_set_lost()
        again = self.ingest()
        self.assertEqual((again["status"], again["lead_id"]), ("existing", first["lead_id"]))

    def test_same_contact_new_request_makes_new_lead_without_duplicate_partner(self):
        first = self.ingest()
        partners = self.Partner.search_count([])
        second = self.ingest(
            external_reference="EDULOC-SUPPORT-aaaaaaaa-2222-3333-4444-555555555555",
            email="awa.diallo@example.com",
            category="reservation",
            details={"sujet": "Annuler un cours"},
        )
        self.assertEqual(second["status"], "created")
        self.assertNotEqual(second["lead_id"], first["lead_id"])
        self.assertEqual(second["partner_id"], first["partner_id"])
        self.assertEqual(self.Partner.search_count([]), partners)

    def test_partner_is_found_by_phone_when_email_differs(self):
        first = self.ingest()
        second = self.ingest(
            external_reference="EDULOC-SUPPORT-bbbbbbbb-2222-3333-4444-555555555555",
            email="autre.adresse@example.com",
            phone="+33 6.12.34.56.78",
        )
        self.assertEqual(second["partner_id"], first["partner_id"])
        partner = self.Partner.browse(first["partner_id"])
        self.assertNotEqual(partner.email_normalized, "autre.adresse@example.com", "Pas d'écrasement.")

    def test_existing_partner_is_only_completed_never_overwritten(self):
        existing = self.Partner.create({"name": "Awa D.", "email": "awa.diallo@example.com", "phone": "01 99 99 99 99"})
        result = self.ingest()
        self.assertEqual(result["partner_id"], existing.id)
        self.assertEqual(existing.phone, "01 99 99 99 99")
        self.assertEqual(existing.name, "Awa D.")

    def test_email_only_and_phone_only_requests(self):
        only_email = self.ingest(phone="", external_reference="EDULOC-SUPPORT-email-only-0001")
        only_phone = self.ingest(email="", phone="07 11 22 33 44", external_reference="EDULOC-SUPPORT-phone-only-0001")
        self.assertEqual(only_email["status"], "created")
        self.assertEqual(only_phone["status"], "created")

    def test_html_in_visitor_text_is_escaped(self):
        result = self.ingest(message="<script>alert(1)</script>")
        description = str(self.Lead.browse(result["lead_id"]).description)
        self.assertNotIn("<script>", description)
        self.assertIn("&lt;script&gt;", description)

    def test_invalid_payloads_are_rejected_without_writes(self):
        leads = self.Lead.search_count([])
        cases = {
            "no contact": {"phone": "", "email": ""},
            "bad category": {"category": "inconnue"},
            "bad email": {"email": "pas-un-email"},
            "bad phone": {"phone": "appelez-moi"},
            "short name": {"full_name": "A"},
            "bad reference": {"external_reference": "x y"},
            "bad date": {"received_at": "hier"},
            "long message": {"message": "x" * 2001},
            "details not object": {"details": ["a"]},
        }
        for label, overrides in cases.items():
            with self.subTest(label), self.assertRaises(IntakeError) as ctx:
                self.ingest(**overrides)
            self.assertEqual(ctx.exception.status, 422, label)
        with self.assertRaises(IntakeError):
            self.intake.ingest(["pas", "un", "objet"])
        self.assertEqual(self.Lead.search_count([]), leads)

    def test_unknown_detail_keys_are_ignored(self):
        result = self.ingest(details={"niveau": "Collège", "intrus": "x"})
        lead = self.Lead.browse(result["lead_id"])
        self.assertEqual(lead.eduloc_level, "Collège")
        self.assertNotIn("intrus", str(lead.description))

    def test_gateway_user_is_not_an_administrator(self):
        gateway = self.env.ref("eduloc_integration.user_eduloc_gateway")
        self.assertFalse(gateway.has_group("base.group_system"))
        self.assertFalse(gateway.has_group("base.group_erp_manager"))
        self.assertFalse(gateway.has_group("sales_team.group_sale_manager"))
        self.assertFalse(gateway.password, "Le compte technique ne doit pas pouvoir ouvrir de session.")

    def test_stock_crm_stages_are_removed_from_the_pipeline(self):
        for xmlid in ("stage_lead1", "stage_lead2", "stage_lead3", "stage_lead4"):
            self.assertFalse(self.env.ref(f"crm.{xmlid}", raise_if_not_found=False), xmlid)

    def test_pipeline_matches_the_specification(self):
        stages = self.env["crm.stage"].search([("team_ids", "in", self.env.ref("eduloc_integration.team_eduloc").id)])
        self.assertEqual(
            stages.mapped("name"),
            ["Nouvelle demande", "À qualifier", "En recherche", "Proposition envoyée", "En attente", "Convertie"],
        )
        self.assertEqual(stages.filtered("is_won").name, "Convertie")

    def test_lost_leads_carry_a_reason(self):
        lead = self.Lead.browse(self.ingest()["lead_id"])
        lead.action_set_lost(lost_reason_id=self.env.ref("eduloc_integration.lost_unreachable").id)
        self.assertFalse(lead.active)
        self.assertEqual(lead.lost_reason_id.name, "Demandeur injoignable")

    def _user(self, login, xmlid):
        return self.env["res.users"].create(
            {"name": login, "login": login, "group_ids": [(6, 0, [self.env.ref(xmlid).id])]}
        )

    def test_agent_and_manager_roles(self):
        agent_a = self._user("agent.a", "sales_team.group_sale_salesman")
        agent_b = self._user("agent.b", "sales_team.group_sale_salesman")
        manager = self._user("responsable", "sales_team.group_sale_manager")
        lead = self.Lead.browse(self.ingest()["lead_id"])

        # Une nouvelle demande non assignée est visible des agents ; le responsable l'attribue.
        self.assertTrue(self.Lead.with_user(agent_a).search([("id", "=", lead.id)]))
        lead.with_user(manager).write({"user_id": agent_a.id})
        self.assertEqual(lead.user_id, agent_a)

        # Une fois attribuée, elle n'est plus visible des autres agents.
        self.assertTrue(self.Lead.with_user(agent_a).search([("id", "=", lead.id)]))
        self.assertFalse(self.Lead.with_user(agent_b).search([("id", "=", lead.id)]))
        self.assertTrue(self.Lead.with_user(manager).search([("id", "=", lead.id)]))

        # L'agent planifie une relance, avance le dossier et le convertit avec la référence de réservation.
        lead.with_user(agent_a).activity_schedule(
            "mail.mail_activity_data_call", summary="Rappeler Mme Diallo", user_id=agent_a.id
        )
        activity = self.env["mail.activity"].search([("res_model", "=", "crm.lead"), ("res_id", "=", lead.id)])
        self.assertEqual(activity.summary, "Rappeler Mme Diallo")
        self.assertEqual(activity.user_id, agent_a)
        stage = self.env.ref("eduloc_integration.stage_converted")
        lead.with_user(agent_a).write({"stage_id": stage.id, "eduloc_reservation_ref": "RES-2026-0042"})
        self.assertEqual(lead.stage_id, stage)
        self.assertEqual(lead.probability, 100)
        self.assertEqual(lead.eduloc_reservation_ref, "RES-2026-0042")

        # Un agent n'a aucun droit d'administration.
        for user in (agent_a, agent_b, manager):
            self.assertFalse(user.has_group("base.group_system"), user.login)

    def test_phone_key(self):
        self.assertEqual(phone_key("06 12 34 56 78"), phone_key("+33 (0)6.12.34.56.78"))
        self.assertEqual(phone_key("+33612345678"), phone_key("0033612345678"))
        self.assertFalse(phone_key("12 34"))
        self.assertFalse(phone_key(False))
