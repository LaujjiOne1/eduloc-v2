import re
from datetime import datetime, timezone

from markupsafe import Markup, escape

from odoo import api, models, tools

from .res_partner import phone_key

EXTERNAL_REF_RE = re.compile(r"^[A-Za-z0-9._:-]{8,100}$")
CATEGORIES = {
    "trouver_tuteur": "Trouver un tuteur",
    "cours_proche": "Cours pour un proche",
    "reservation": "Aide sur une réservation",
    "autre": "Autre question",
}
# Clés de `details` de l'assistant guidé -> champ de la piste, et libellé dans la description.
DETAIL_FIELDS = {
    "pour": ("eduloc_for_whom", "Pour qui"),
    "niveau": ("eduloc_level", "Niveau"),
    "matiere": ("eduloc_subject", "Matière"),
    "format": ("eduloc_format", "Format"),
    "frequence": ("eduloc_frequency", "Fréquence"),
    "ville": ("eduloc_city", "Ville / zone"),
}
EXTRA_DETAIL_LABELS = {"sujet": "Sujet", "reference": "Tuteur ou date du cours"}
MAX_DETAIL_LENGTH = 200


class IntakeError(Exception):
    """Erreur d'ingestion à renvoyer telle quelle au client de l'API."""

    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _text(value, field, max_length, required=False):
    if value is None or value == "":
        if required:
            raise IntakeError(422, "invalid_payload", f"Le champ « {field} » est obligatoire.")
        return ""
    if not isinstance(value, str):
        raise IntakeError(422, "invalid_payload", f"Le champ « {field} » doit être une chaîne.")
    value = value.strip()
    if len(value) > max_length:
        raise IntakeError(422, "invalid_payload", f"Le champ « {field} » dépasse {max_length} caractères.")
    if required and not value:
        raise IntakeError(422, "invalid_payload", f"Le champ « {field} » est obligatoire.")
    return value


def _received_at(value):
    """Date de réception du site (ISO 8601) en UTC naïf, comme les champs Datetime d'Odoo."""
    if not value:
        return False
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise IntakeError(422, "invalid_payload", "Le champ « received_at » n'est pas une date ISO 8601.") from exc
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _is_unique_violation(exc):
    return getattr(exc, "pgcode", None) == "23505" or getattr(exc, "sqlstate", None) == "23505"


class SupportIntake(models.AbstractModel):
    _name = "eduloc.support.intake"
    _description = "Réception des demandes du site vitrine EduLoc"

    @api.model
    def parse_payload(self, payload):
        """Valide et normalise le corps JSON reçu. Ne touche pas à la base."""
        if not isinstance(payload, dict):
            raise IntakeError(422, "invalid_payload", "Le corps de la requête doit être un objet JSON.")

        external_ref = _text(payload.get("external_reference"), "external_reference", 100, required=True)
        if not EXTERNAL_REF_RE.match(external_ref):
            raise IntakeError(422, "invalid_payload", "Format de « external_reference » invalide.")

        category = _text(payload.get("category"), "category", 40, required=True)
        if category not in CATEGORIES:
            raise IntakeError(422, "invalid_payload", f"Catégorie inconnue : {category}.")

        full_name = _text(payload.get("full_name"), "full_name", 100, required=True)
        if len(full_name) < 2:
            raise IntakeError(422, "invalid_payload", "Le nom doit comporter au moins 2 caractères.")

        email_raw = _text(payload.get("email"), "email", 255)
        email = tools.email_normalize(email_raw) if email_raw else ""
        if email_raw and not email:
            raise IntakeError(422, "invalid_payload", "Adresse e-mail invalide.")
        phone = _text(payload.get("phone"), "phone", 30)
        if phone and not re.fullmatch(r"[+\d\s().-]+", phone):
            raise IntakeError(422, "invalid_payload", "Numéro de téléphone invalide.")
        if not email and not phone:
            raise IntakeError(422, "invalid_payload", "Un téléphone ou un e-mail est requis.")

        details = payload.get("details") or {}
        if not isinstance(details, dict):
            raise IntakeError(422, "invalid_payload", "Le champ « details » doit être un objet.")
        known = set(DETAIL_FIELDS) | set(EXTRA_DETAIL_LABELS)
        clean_details = {
            key: _text(details.get(key), f"details.{key}", MAX_DETAIL_LENGTH) for key in known if details.get(key)
        }

        return {
            "external_ref": external_ref,
            "public_ref": _text(payload.get("public_reference"), "public_reference", 32),
            "received_at": _received_at(payload.get("received_at")),
            "category": category,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "preferred_channel": _text(payload.get("preferred_channel"), "preferred_channel", 40),
            "message": _text(payload.get("message"), "message", 2000),
            "details": clean_details,
        }

    @api.model
    def _gateway_user(self):
        user = self.env.ref("eduloc_integration.user_eduloc_gateway", raise_if_not_found=False)
        if not user or not user.active:
            raise IntakeError(503, "gateway_unavailable", "Le compte technique de la passerelle est indisponible.")
        return user

    @api.model
    def ingest(self, payload):
        """Crée (ou retrouve) la piste CRM d'une demande du site.

        Retourne {"status": "created" | "existing", "lead_id", "partner_id", "external_reference"}.
        L'appel est idempotent sur `external_reference`.
        """
        data = self.parse_payload(payload)
        gateway = self._gateway_user()

        # Recherche d'idempotence en sudo : l'agent peut s'être assigné la piste, que le
        # compte technique ne voit alors plus. Seul l'identifiant est lu.
        def find_existing():
            lead = (
                self.env["crm.lead"]
                .sudo()
                .with_context(active_test=False)
                .search([("eduloc_external_ref", "=", data["external_ref"])], limit=1)
            )
            if lead:
                return {
                    "status": "existing",
                    "lead_id": lead.id,
                    "partner_id": lead.partner_id.id or False,
                    "external_reference": data["external_ref"],
                }
            return None

        existing = find_existing()
        if existing:
            return existing

        env = self.with_user(gateway).env
        try:
            with env.cr.savepoint():
                partner = self._find_or_create_partner(env, data)
                lead = env["crm.lead"].create(self._lead_values(env, data, partner))
        except Exception as exc:  # noqa: BLE001 - on ne traite que le doublon concurrent
            if _is_unique_violation(exc):
                # Deux envois simultanés de la même demande : le second retrouve la piste du premier.
                existing = find_existing()
                if existing:
                    return existing
            raise
        return {
            "status": "created",
            "lead_id": lead.id,
            "partner_id": partner.id,
            "external_reference": data["external_ref"],
        }

    @api.model
    def _find_or_create_partner(self, env, data):
        partners = env["res.partner"]
        partner = partners.browse()
        # 1. e-mail normalisé, 2. numéro normalisé, 3. nouveau contact.
        if data["email"]:
            partner = partners.search([("email_normalized", "=", data["email"])], order="id", limit=1)
        key = phone_key(data["phone"])
        if not partner and key:
            partner = partners.search([("eduloc_phone_key", "=", key)], order="id", limit=1)
        if partner:
            # On complète seulement ce qui manque : jamais d'écrasement d'un contact existant.
            fill = {}
            if data["email"] and not partner.email:
                fill["email"] = data["email"]
            if data["phone"] and not partner.phone:
                fill["phone"] = data["phone"]
            if fill:
                partner.write(fill)
            return partner
        return partners.create(
            {
                "name": data["full_name"],
                "email": data["email"] or False,
                "phone": data["phone"] or False,
                "is_company": False,
            }
        )

    @api.model
    def _lead_values(self, env, data, partner):
        category = data["category"]
        details = data["details"]
        label = CATEGORIES[category]
        prefix = f"[{data['public_ref']}] " if data["public_ref"] else ""
        topic = details.get("matiere") or details.get("sujet")
        title = f"{prefix}{label}{' — ' + topic if topic else ''} — {data['full_name']}"

        values = {
            "name": title,
            "type": "opportunity",
            # email_from / phone / contact_name sont déduits du contact. Les renseigner ici
            # déclencherait l'inverse natif d'Odoo, qui réécrirait le contact existant.
            "partner_id": partner.id,
            # Sans cette valeur, Odoo attribuerait la piste au compte technique.
            "user_id": False,
            "team_id": env.ref("eduloc_integration.team_eduloc").id,
            "stage_id": env.ref("eduloc_integration.stage_new_request").id,
            "source_id": env.ref("eduloc_integration.utm_source_website").id,
            "tag_ids": [(6, 0, [env.ref(f"eduloc_integration.tag_{category}").id])],
            "description": self._description_html(data),
            "eduloc_external_ref": data["external_ref"],
            "eduloc_public_ref": data["public_ref"] or False,
            "eduloc_received_at": data["received_at"] or False,
            "eduloc_request_type": category,
            "eduloc_preferred_channel": data["preferred_channel"] or False,
        }
        for key, (field_name, _label) in DETAIL_FIELDS.items():
            values[field_name] = details.get(key) or False
        return values

    @api.model
    def _description_html(self, data):
        details = data["details"]
        items = [
            Markup("<li>{}&nbsp;: {}</li>").format(label, details[key])
            for key, (_field, label) in DETAIL_FIELDS.items()
            if key in details
        ]
        items += [
            Markup("<li>{}&nbsp;: {}</li>").format(label, details[key])
            for key, label in EXTRA_DETAIL_LABELS.items()
            if key in details
        ]
        html = Markup("<p><b>Demande reçue via le site vitrine EduLoc</b> — {}</p>").format(CATEGORIES[data["category"]])
        if items:
            html += Markup("<ul>{}</ul>").format(Markup("").join(items))
        if data["message"]:
            html += Markup("<p><b>Message du demandeur&nbsp;:</b><br/>{}</p>").format(
                Markup("<br/>").join(escape(line) for line in data["message"].splitlines())
            )
        if data["preferred_channel"]:
            html += Markup("<p>À recontacter par&nbsp;: {}</p>").format(data["preferred_channel"])
        # Coordonnées telles que saisies : elles peuvent différer de celles du contact retrouvé.
        entered = " · ".join(part for part in (data["full_name"], data["phone"], data["email"]) if part)
        html += Markup("<p><i>Coordonnées saisies sur le site&nbsp;: {}</i></p>").format(entered)
        return html
