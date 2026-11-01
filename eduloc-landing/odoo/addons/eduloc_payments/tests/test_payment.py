import json

from odoo.tests import TransactionCase, tagged

from ..models.payment import PaymentError, decide_transition

PAYMENT = "11111111-1111-4111-8111-111111111111"
RESERVATION = "22222222-2222-4222-8222-222222222222"


def make_payload(**overrides):
    payload = {
        "event_id": "evt_open_00000001",
        "payment_id": PAYMENT,
        "reservation_id": RESERVATION,
        "status": "PENDING",
        "amount": "47000.00",
        "currency": "MGA",
        "method": "visa_stripe",
        "customer_name": "Aina Rakoto",
        "customer_email": "aina@example.mg",
        "description": "Mathématiques — Lova R.",
    }
    payload.update(overrides)
    return payload


@tagged("post_install", "-at_install")
class TestPayment(TransactionCase):
    def ingest(self, **overrides):
        return self.env["eduloc.payment"].ingest(make_payload(**overrides))

    def payment(self):
        return self.env["eduloc.payment"].search([("payment_ref", "=", PAYMENT)])

    def test_transition_rules(self):
        self.assertEqual(decide_transition("pending", "succeeded"), ("succeeded", False))
        self.assertEqual(decide_transition("pending", "failed"), ("failed", False))
        self.assertEqual(decide_transition("failed", "cancelled"), (None, False))
        self.assertEqual(decide_transition("failed", "pending"), (None, False))
        self.assertEqual(decide_transition("succeeded", "failed"), (None, True))
        self.assertEqual(decide_transition("succeeded", "pending"), (None, False))
        self.assertEqual(decide_transition("expired", "succeeded"), ("succeeded", True))

    def test_create_is_pending_and_idempotent_by_event(self):
        first = self.ingest()
        self.assertEqual(first["status"], "created")
        self.assertEqual(self.payment().status, "pending")
        again = self.ingest()
        self.assertEqual(again["status"], "duplicate")
        self.assertEqual(self.env["eduloc.payment"].search_count([("payment_ref", "=", PAYMENT)]), 1)
        self.assertEqual(self.env["eduloc.payment.event"].search_count([("payment_id", "=", self.payment().id)]), 1)

    def test_verified_success_settles_the_payment(self):
        self.ingest()
        result = self.ingest(
            event_id="evt_done_00000002", status="SUCCEEDED", provider="stripe", provider_ref="pi_123",
            card_brand="visa", card_last4="4242",
        )
        self.assertEqual(result["status"], "updated")
        payment = self.payment()
        self.assertEqual(payment.status, "succeeded")
        self.assertTrue(payment.settled_at)
        self.assertEqual((payment.card_brand, payment.card_last4, payment.provider_ref), ("visa", "4242", "pi_123"))
        self.assertFalse(payment.has_anomaly)

    def test_mismatching_success_is_rejected_and_flagged(self):
        self.ingest()
        for index, change in enumerate((
            {"amount": "1000.00"}, {"currency": "EUR"}, {"reservation_id": "33333333-3333-4333-8333-333333333333"},
        )):
            result = self.ingest(event_id=f"evt_bad_0000000{index}", status="SUCCEEDED", **change)
            self.assertEqual(result["status"], "rejected", change)
        payment = self.payment()
        self.assertEqual(payment.status, "pending", "rien n'est validé sur une notification incohérente")
        self.assertTrue(payment.has_anomaly)

    def test_success_without_amount_is_not_a_verified_success(self):
        self.ingest()
        result = self.env["eduloc.payment"].ingest(
            {"event_id": "evt_noamount_001", "payment_id": PAYMENT, "status": "SUCCEEDED"}
        )
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(self.payment().status, "pending")

    def test_success_is_terminal_and_late_failure_is_an_anomaly(self):
        self.ingest()
        self.ingest(event_id="evt_done_00000002", status="SUCCEEDED")
        result = self.ingest(event_id="evt_late_00000003", status="FAILED", failure_reason="timeout")
        self.assertEqual(result["status"], "updated")
        payment = self.payment()
        self.assertEqual(payment.status, "succeeded")
        self.assertTrue(payment.has_anomaly)

    def test_late_success_after_failure_is_accepted_but_flagged(self):
        self.ingest()
        self.ingest(event_id="evt_fail_00000002", status="FAILED")
        self.ingest(event_id="evt_done_00000003", status="SUCCEEDED")
        payment = self.payment()
        self.assertEqual(payment.status, "succeeded")
        self.assertTrue(payment.has_anomaly)

    def test_intermediate_states_stay_pending(self):
        self.ingest()
        for index, state in enumerate(("PROCESSING", "REQUIRES_ACTION", "REQUIRES_PAYMENT_METHOD")):
            self.ingest(event_id=f"evt_mid_0000000{index}", status=state)
        self.assertEqual(self.payment().status, "pending")

    def test_sensitive_data_is_never_kept(self):
        self.ingest()
        self.ingest(
            event_id="evt_done_00000002", status="SUCCEEDED", card_last4="4242",
            cvv="123", pin="0000", card_number="4242424242424242", payment_method_token="pm_x", nested={"otp": "99", "ok": 1},
        )
        journal = " ".join(self.payment().event_ids.mapped("details"))
        for secret in ("4242424242424242", '"123"', '"0000"', "pm_x"):
            self.assertNotIn(secret, journal)
        done = self.env["eduloc.payment.event"].search([("event_id", "=", "evt_done_00000002")])
        self.assertEqual(json.loads(done.details)["cvv"], "[retiré]")

    def test_invalid_payloads(self):
        for label, overrides in (
            ("event_id court", {"event_id": "x"}),
            ("payment_id pas un UUID", {"payment_id": "abc"}),
            ("statut inconnu", {"status": "BANANE"}),
            ("montant nul", {"amount": "0"}),
            ("devise invalide", {"currency": "MGAR"}),
        ):
            with self.subTest(label), self.assertRaises(PaymentError):
                self.ingest(**overrides)
        self.assertFalse(self.payment())

    def test_agents_cannot_write_or_create_payments(self):
        self.ingest()
        agent = self.env["res.users"].create({
            "name": "Agent test", "login": "agent.pay@example.mg",
            "group_ids": [(6, 0, [self.env.ref("sales_team.group_sale_salesman").id, self.env.ref("base.group_user").id])],
        })
        payment = self.payment().with_user(agent)
        self.assertTrue(payment.read(["status"]))
        from odoo.exceptions import AccessError
        with self.assertRaises(AccessError):
            payment.write({"status": "succeeded"})
        with self.assertRaises(AccessError):
            self.env["eduloc.payment"].with_user(agent).create({
                "payment_ref": "44444444-4444-4444-8444-444444444444", "reservation_ref": RESERVATION, "amount": 1,
            })
