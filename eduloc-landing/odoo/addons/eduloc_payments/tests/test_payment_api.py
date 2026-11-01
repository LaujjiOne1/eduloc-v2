import json
import os
from unittest.mock import patch

from odoo.tests import HttpCase, tagged

from .test_payment import PAYMENT, make_payload

URL = "/eduloc/api/v1/payments"
TOKEN = "test-payments-token-123"


@tagged("post_install", "-at_install")
class TestPaymentApi(HttpCase):
    def setUp(self):
        super().setUp()
        env_patch = patch.dict(os.environ, {"EDULOC_PAYMENTS_TOKEN": TOKEN})
        env_patch.start()
        self.addCleanup(env_patch.stop)

    def post(self, payload, token=TOKEN, raw=None):
        headers = {"Content-Type": "application/json"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        return self.url_open(URL, data=raw if raw is not None else json.dumps(payload), headers=headers)

    def get(self, payment_id, token=TOKEN):
        headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
        return self.url_open(f"{URL}/{payment_id}", headers=headers)

    def test_create_update_read(self):
        created = self.post(make_payload())
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()["status"], "created")

        updated = self.post(make_payload(event_id="evt_done_00000002", status="SUCCEEDED", provider="stripe", card_last4="4242"))
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["payment"]["state"], "SUCCEEDED")

        read = self.get(PAYMENT)
        self.assertEqual(read.status_code, 200)
        body = read.json()["payment"]
        self.assertEqual((body["state"], body["amount"], body["currency"], body["card_last4"]), ("SUCCEEDED", "47000.00", "MGA", "4242"))

    def test_replay_has_no_effect(self):
        self.post(make_payload())
        replay = self.post(make_payload())
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.json()["status"], "duplicate")

    def test_authentication(self):
        for label, token in (("sans jeton", None), ("mauvais jeton", "nope"), ("jeton vide", "")):
            with self.subTest(label):
                self.assertEqual(self.post(make_payload(), token=token).status_code, 401)
                self.assertEqual(self.get(PAYMENT, token=token).status_code, 401)
        self.assertFalse(self.env["eduloc.payment"].search([("payment_ref", "=", PAYMENT)]))

    def test_disabled_when_token_not_configured(self):
        with patch.dict(os.environ, {"EDULOC_PAYMENTS_TOKEN": ""}):
            self.assertEqual(self.post(make_payload(), token="").status_code, 503)

    def test_mismatch_is_a_422_and_changes_nothing(self):
        self.post(make_payload())
        bad = self.post(make_payload(event_id="evt_bad_00000002", status="SUCCEEDED", amount="1.00"))
        self.assertEqual(bad.status_code, 422)
        self.assertEqual(bad.json()["error"]["code"], "mismatch")
        self.assertEqual(self.get(PAYMENT).json()["payment"]["state"], "PENDING")

    def test_invalid_json_and_unknown_payment(self):
        self.assertEqual(self.post(None, raw="{pas du json").status_code, 400)
        self.assertEqual(self.get("55555555-5555-4555-8555-555555555555").status_code, 404)
        self.assertEqual(self.get("pas-un-uuid").status_code, 422)
