import hmac
import json
import logging
import os

from odoo import http
from odoo.http import request

from ..models.support_intake import IntakeError

_logger = logging.getLogger(__name__)

MAX_BODY_BYTES = 64 * 1024
TOKEN_ENV_VAR = "EDULOC_API_TOKEN"


def _json(status, body):
    return request.make_json_response(body, status=status)


def _error(status, code, message):
    return _json(status, {"error": {"code": code, "message": message}})


class SupportRequestController(http.Controller):
    @http.route(
        "/eduloc/api/v1/support-requests",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
        save_session=False,
    )
    def create_support_request(self, **_kwargs):
        expected = os.environ.get(TOKEN_ENV_VAR, "")
        if not expected:
            _logger.error("%s n'est pas défini : endpoint désactivé.", TOKEN_ENV_VAR)
            return _error(503, "not_configured", "L'intégration n'est pas configurée.")

        header = request.httprequest.headers.get("Authorization", "")
        scheme, _, provided = header.partition(" ")
        if scheme.lower() != "bearer" or not hmac.compare_digest(provided.strip().encode(), expected.encode()):
            return _error(401, "unauthorized", "Jeton d'API invalide.")

        raw = request.httprequest.get_data(cache=False)
        if len(raw) > MAX_BODY_BYTES:
            return _error(413, "payload_too_large", "Requête trop volumineuse.")
        try:
            payload = json.loads(raw or b"")
        except ValueError:
            return _error(400, "invalid_json", "Le corps de la requête n'est pas un JSON valide.")

        try:
            # Le savepoint annule toute écriture partielle : la réponse d'erreur ne doit pas être validée.
            with request.env.cr.savepoint():
                result = request.env["eduloc.support.intake"].sudo().ingest(payload)
        except IntakeError as exc:
            return _error(exc.status, exc.code, exc.message)
        except Exception:  # noqa: BLE001
            _logger.exception("Échec de l'ingestion d'une demande du site.")
            return _error(500, "internal_error", "Erreur interne lors de la création de la piste.")
        return _json(201 if result["status"] == "created" else 200, result)
