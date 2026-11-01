import hmac
import json
import logging
import os

from odoo import http
from odoo.http import request

from ..models.payment import PAYMENT_REF_RE, PaymentError

_logger = logging.getLogger(__name__)

MAX_BODY_BYTES = 64 * 1024
# Secret propre aux paiements, distinct de celui du site vitrine (EDULOC_API_TOKEN) : une fuite ne donne pas accès aux deux.
TOKEN_ENV_VAR = "EDULOC_PAYMENTS_TOKEN"


def _json(status, body):
    return request.make_json_response(body, status=status)


def _error(status, code, message):
    return _json(status, {"error": {"code": code, "message": message}})


def _authenticate():
    """Renvoie une réponse d'erreur si l'appelant n'est pas le service de paiement, sinon None."""
    expected = os.environ.get(TOKEN_ENV_VAR, "")
    if not expected:
        _logger.error("%s n'est pas défini : endpoint des paiements désactivé.", TOKEN_ENV_VAR)
        return _error(503, "not_configured", "L'enregistrement des paiements n'est pas configuré.")
    header = request.httprequest.headers.get("Authorization", "")
    scheme, _, provided = header.partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(provided.strip().encode(), expected.encode()):
        return _error(401, "unauthorized", "Jeton d'API invalide.")
    return None


class PaymentController(http.Controller):
    @http.route("/eduloc/api/v1/payments", type="http", auth="public", methods=["POST"], csrf=False, save_session=False)
    def upsert_payment(self, **_kwargs):
        denied = _authenticate()
        if denied:
            return denied
        raw = request.httprequest.get_data(cache=False)
        if len(raw) > MAX_BODY_BYTES:
            return _error(413, "payload_too_large", "Requête trop volumineuse.")
        try:
            payload = json.loads(raw or b"")
        except ValueError:
            return _error(400, "invalid_json", "Le corps de la requête n'est pas un JSON valide.")
        try:
            # Le savepoint annule toute écriture partielle d'une requête refusée.
            with request.env.cr.savepoint():
                result = request.env["eduloc.payment"].sudo().ingest(payload)
        except PaymentError as exc:
            return _error(exc.status, exc.code, exc.message)
        except Exception:  # noqa: BLE001
            _logger.exception("Échec de l'enregistrement d'un paiement.")
            return _error(500, "internal_error", "Erreur interne lors de l'enregistrement du paiement.")
        if result["status"] == "rejected":
            return _json(422, {"error": {"code": "mismatch", "message": f"Paiement incohérent : {result['reason']}."}, **result})
        return _json(201 if result["status"] == "created" else 200, result)

    @http.route("/eduloc/api/v1/payments/<string:payment_ref>", type="http", auth="public", methods=["GET"], csrf=False, save_session=False)
    def get_payment(self, payment_ref, **_kwargs):
        denied = _authenticate()
        if denied:
            return denied
        if not PAYMENT_REF_RE.match(payment_ref):
            return _error(422, "invalid_payload", "payment_id doit être un UUID.")
        payment = request.env["eduloc.payment"].sudo().search([("payment_ref", "=", payment_ref.lower())], limit=1)
        if not payment:
            return _error(404, "not_found", "Paiement introuvable.")
        return _json(200, {"payment": payment._to_dict()})
