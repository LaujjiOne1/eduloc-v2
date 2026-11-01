import json
import os
from unittest.mock import patch

from odoo.tests import HttpCase, tagged

from .test_support_intake import make_payload

URL = "/eduloc/api/v1/support-requests"
TOKEN = "test-token-123"


@tagged("post_install", "-at_install")
class TestSupportApi(HttpCase):
    def post(self, payload, token=TOKEN, raw=None):
        headers = {"Content-Type": "application/json"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        body = raw if raw is not None else json.dumps(payload)
        return self.url_open(URL, data=body, headers=headers)

    def setUp(self):
        super().setUp()
        env_patch = patch.dict(os.environ, {"EDULOC_API_TOKEN": TOKEN})
        env_patch.start()
        self.addCleanup(env_patch.stop)

    def test_create_then_replay(self):
        created = self.post(make_payload())
        self.assertEqual(created.status_code, 201, created.text)
        body = created.json()
        self.assertEqual(body["status"], "created")
        self.assertEqual(body["external_reference"], make_payload()["external_reference"])

        replay = self.post(make_payload())
        self.assertEqual(replay.status_code, 200, replay.text)
        self.assertEqual(replay.json()["status"], "existing")
        self.assertEqual(replay.json()["lead_id"], body["lead_id"])
        self.assertEqual(
            self.env["crm.lead"].search_count([("eduloc_external_ref", "=", make_payload()["external_reference"])]), 1
        )

    def test_authentication(self):
        for label, token in (("sans jeton", None), ("mauvais jeton", "nope"), ("jeton vide", "")):
            with self.subTest(label):
                response = self.post(make_payload(), token=token)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["error"]["code"], "unauthorized")
        self.assertFalse(self.env["crm.lead"].search([("eduloc_external_ref", "=", make_payload()["external_reference"])]))

    def test_disabled_when_token_not_configured(self):
        with patch.dict(os.environ, {"EDULOC_API_TOKEN": ""}):
            response = self.post(make_payload(), token="")
        self.assertEqual(response.status_code, 503)

    def test_invalid_json(self):
        response = self.post(None, raw="{pas du json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "invalid_json")

    def test_invalid_payload_returns_422_with_message(self):
        response = self.post(make_payload(category="nimporte"))
        self.assertEqual(response.status_code, 422)
        self.assertIn("Catégorie", response.json()["error"]["message"])

    def test_payload_too_large(self):
        response = self.post(make_payload(message="x" * 70000))
        self.assertEqual(response.status_code, 413)

    def test_get_is_not_allowed(self):
        self.assertEqual(self.url_open(URL).status_code, 405)
