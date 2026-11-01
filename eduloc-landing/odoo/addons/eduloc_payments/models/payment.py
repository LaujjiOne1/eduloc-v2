import json
import re
from datetime import datetime, timezone

from odoo import api, fields, models

PAYMENT_REF_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
EVENT_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,160}$")
STATUSES = [
    ("pending", "En cours"),
    ("succeeded", "Réussi"),
    ("failed", "Échoué"),
    ("cancelled", "Annulé"),
    ("expired", "Expiré"),
]
METHODS = [("visa_stripe", "Carte (Visa / Mastercard)"), ("mobile_money", "Mobile Money")]
# Statuts reçus du service de paiement -> statut interne.
INBOUND_STATUS = {
    "PENDING": "pending", "PROCESSING": "pending", "REQUIRES_ACTION": "pending", "REQUIRES_PAYMENT_METHOD": "pending",
    "SUCCEEDED": "succeeded", "FAILED": "failed", "CANCELLED": "cancelled", "CANCELED": "cancelled", "EXPIRED": "expired",
}
# Jamais conservé, même s'il arrivait par erreur : CVV, PIN, numéro de carte, secrets (VISA-02, MM-01).
FORBIDDEN_KEY = re.compile(
    r"(^|[_-])(cvv|cvc|pin|pan|otp)($|[_-])|card_?number|phone_?number|secret|token|authorization|password|signature",
    re.IGNORECASE,
)


class PaymentError(Exception):
    """Erreur à renvoyer telle quelle au client de l'API."""

    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def decide_transition(current, incoming):
    """(nouveau statut ou None, anomalie). Mêmes règles que le backend EduLoc :

    - « réussi » est terminal ;
    - un succès confirmé l'emporte toujours (le prestataire fait foi) mais, après un échec / une annulation / une expiration,
      il est signalé comme anomalie ;
    - échec, annulation et expiration ne s'échangent pas et ne repassent pas à « en cours ».
    """
    if current == incoming:
        return None, False
    if current == "succeeded":
        return None, incoming != "pending"
    if incoming == "succeeded":
        return "succeeded", current != "pending"
    if current == "pending":
        return incoming, False
    return None, False


def _text(value, field, max_length, required=False):
    if value is None or value == "":
        if required:
            raise PaymentError(422, "invalid_payload", f"Le champ « {field} » est obligatoire.")
        return ""
    if not isinstance(value, (str, int, float)):
        raise PaymentError(422, "invalid_payload", f"Le champ « {field} » doit être un texte.")
    value = str(value).strip()
    if len(value) > max_length:
        raise PaymentError(422, "invalid_payload", f"Le champ « {field} » dépasse {max_length} caractères.")
    return value


def _sanitize(value, depth=0):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if depth > 4:
        return "[tronqué]"
    if isinstance(value, list):
        return [_sanitize(v, depth + 1) for v in value[:20]]
    if isinstance(value, dict):
        return {k: ("[retiré]" if FORBIDDEN_KEY.search(str(k)) else _sanitize(v, depth + 1)) for k, v in value.items()}
    return str(value)


def _datetime(value):
    if not value:
        return False
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return False
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


class EdulocPayment(models.Model):
    _name = "eduloc.payment"
    _description = "Paiement EduLoc"
    _inherit = ["mail.thread"]
    _order = "create_date desc, id desc"

    _payment_ref_uniq = models.Constraint("UNIQUE(payment_ref)", "Ce paiement est déjà enregistré.")

    name = fields.Char(compute="_compute_name", store=True)
    payment_ref = fields.Char("Référence du paiement", required=True, index=True, readonly=True)
    reservation_ref = fields.Char("Réservation EduLoc", required=True, index=True, readonly=True)
    customer_name = fields.Char("Client", readonly=True)
    customer_email = fields.Char("E-mail", readonly=True)
    description = fields.Char("Libellé", readonly=True)

    amount = fields.Float("Montant", digits=(12, 2), required=True, readonly=True)
    currency = fields.Char("Devise", required=True, readonly=True, default="MGA")
    method = fields.Selection(METHODS, "Moyen de paiement", readonly=True)
    provider = fields.Char("Prestataire / opérateur", readonly=True)
    provider_ref = fields.Char("Référence de transaction", index=True, readonly=True)
    operator_ref = fields.Char("Référence opérateur (suivi)", readonly=True)
    card_brand = fields.Char("Marque de carte", readonly=True)
    card_last4 = fields.Char("4 derniers chiffres", size=4, readonly=True)

    status = fields.Selection(STATUSES, "Statut", required=True, default="pending", readonly=True, tracking=True, index=True)
    failure_reason = fields.Char("Motif d'échec", readonly=True)
    last_verified_at = fields.Datetime("Dernière vérification", readonly=True)
    settled_at = fields.Datetime("Encaissé le", readonly=True)
    has_anomaly = fields.Boolean("Anomalie à traiter", readonly=True, tracking=True)
    anomaly_note = fields.Text("Détail de l'anomalie", readonly=True)

    refund_status = fields.Selection(
        [("none", "Aucun"), ("requested", "Demandé"), ("approved", "Accepté"), ("rejected", "Refusé"), ("refunded", "Remboursé")],
        "Remboursement", default="none", readonly=True,
    )
    refund_ref = fields.Char("Référence de remboursement", readonly=True)

    event_ids = fields.One2many("eduloc.payment.event", "payment_id", "Historique", readonly=True)

    @api.depends("payment_ref")
    def _compute_name(self):
        for record in self:
            record.name = f"PAY-{(record.payment_ref or '')[:8].upper()}"

    # ------------------------------------------------------------------ API
    @api.model
    def ingest(self, payload):
        """Crée ou fait évoluer un paiement d'après une notification du service de paiement. Idempotent par `event_id`.

        Renvoie {"status": "created" | "updated" | "unchanged" | "duplicate" | "rejected", "payment": {...}}.
        « rejected » = incohérence avec le paiement déjà enregistré (réservation, montant ou devise) : l'anomalie est
        enregistrée et le statut n'est PAS modifié.
        """
        if not isinstance(payload, dict):
            raise PaymentError(400, "invalid_json", "Le corps de la requête doit être un objet JSON.")
        event_id = _text(payload.get("event_id"), "event_id", 160, required=True)
        if not EVENT_ID_RE.match(event_id):
            raise PaymentError(422, "invalid_payload", "event_id invalide.")
        payment_ref = _text(payload.get("payment_id"), "payment_id", 64, required=True).lower()
        if not PAYMENT_REF_RE.match(payment_ref):
            raise PaymentError(422, "invalid_payload", "payment_id doit être un UUID.")
        raw_status = _text(payload.get("status"), "status", 40, required=True).upper()
        status = INBOUND_STATUS.get(raw_status)
        if not status:
            raise PaymentError(422, "invalid_payload", f"Statut inconnu : {raw_status}.")

        Event = self.env["eduloc.payment.event"]
        if Event.search_count([("event_id", "=", event_id)]):
            existing = self.search([("payment_ref", "=", payment_ref)], limit=1)
            return {"status": "duplicate", "payment": existing._to_dict() if existing else None}

        reservation_ref = _text(payload.get("reservation_id"), "reservation_id", 64)
        amount_raw = payload.get("amount")
        currency = _text(payload.get("currency"), "currency", 3).upper()
        try:
            amount = round(float(amount_raw), 2) if amount_raw not in (None, "") else None
        except (TypeError, ValueError):
            raise PaymentError(422, "invalid_payload", "Montant invalide.") from None

        details = _sanitize({k: v for k, v in payload.items() if k not in ("event_id",)})
        payment = self.search([("payment_ref", "=", payment_ref)], limit=1)

        if not payment:
            if not reservation_ref or amount is None or amount <= 0 or len(currency) != 3:
                raise PaymentError(422, "invalid_payload", "Création : reservation_id, amount (> 0) et currency sont obligatoires.")
            method = _text(payload.get("method"), "method", 30)
            payment = self.create({
                "payment_ref": payment_ref,
                "reservation_ref": reservation_ref,
                "customer_name": _text(payload.get("customer_name"), "customer_name", 200),
                "customer_email": _text(payload.get("customer_email"), "customer_email", 200),
                "description": _text(payload.get("description"), "description", 250),
                "amount": amount,
                "currency": currency,
                "method": method if method in dict(METHODS) else False,
                "status": "pending",
            })
            outcome = "created"
            previous = False
        else:
            outcome = "updated"
            previous = payment.status
            mismatch = self._find_mismatch(payment, reservation_ref, amount, currency, status)
            if mismatch:
                payment.sudo().write({"has_anomaly": True, "anomaly_note": f"Notification incohérente : {mismatch}."})
                Event.create({
                    "payment_id": payment.id, "event_id": f"anomaly:{event_id}"[:160], "source": payload.get("source") or "pay-service",
                    "type": "anomaly.mismatch", "from_status": previous, "to_status": previous,
                    "details": json.dumps(details, ensure_ascii=False),
                })
                return {"status": "rejected", "reason": mismatch, "payment": payment._to_dict()}

        new_status, anomaly = decide_transition(payment.status, status)
        now = fields.Datetime.now()
        values = {"last_verified_at": now}
        for key, field, limit in (
            ("provider", "provider", 60), ("provider_ref", "provider_ref", 120), ("operator_ref", "operator_ref", 120),
            ("card_brand", "card_brand", 30),
        ):
            text = _text(payload.get(key), key, limit)
            if text:
                values[field] = text
        last4 = _text(payload.get("card_last4"), "card_last4", 4)
        if last4:
            if not re.fullmatch(r"\d{4}", last4):
                raise PaymentError(422, "invalid_payload", "card_last4 doit contenir 4 chiffres.")
            values["card_last4"] = last4
        method = _text(payload.get("method"), "method", 30)
        if method in dict(METHODS):
            values["method"] = method
        if new_status:
            values["status"] = new_status
            if new_status == "succeeded":
                values["settled_at"] = payment.settled_at or now
            if new_status in ("failed", "cancelled"):
                values["failure_reason"] = _text(payload.get("failure_reason"), "failure_reason", 200)
        if anomaly:
            values.update({
                "has_anomaly": True,
                "anomaly_note": f"Statut « {status} » reçu alors que le paiement était « {payment.status} ».",
            })
        payment.sudo().write(values)
        Event.create({
            "payment_id": payment.id, "event_id": event_id, "source": _text(payload.get("source"), "source", 40) or "pay-service",
            "type": "anomaly.late_status" if anomaly else "payment.updated", "from_status": previous or False,
            "to_status": payment.status, "details": json.dumps(details, ensure_ascii=False),
        })
        if outcome == "updated" and not new_status and not anomaly:
            outcome = "unchanged"
        return {"status": outcome, "payment": payment._to_dict()}

    @api.model
    def _find_mismatch(self, payment, reservation_ref, amount, currency, status):
        """Raison de l'incohérence avec ce qui est déjà enregistré, ou None. Un succès doit confirmer montant et devise."""
        if reservation_ref and reservation_ref != payment.reservation_ref:
            return "réservation différente"
        if currency and currency != payment.currency:
            return "devise différente"
        if amount is not None and abs(amount - payment.amount) > 0.005:
            return "montant différent"
        if status == "succeeded" and (amount is None or not currency):
            return "succès sans montant ni devise confirmés"
        return None

    def _to_dict(self):
        self.ensure_one()
        return {
            "payment_id": self.payment_ref,
            "reservation_id": self.reservation_ref,
            "state": self.status.upper(),
            "amount": f"{self.amount:.2f}",
            "currency": self.currency,
            "method": self.method or None,
            "provider": self.provider or None,
            "provider_ref": self.provider_ref or None,
            "operator_ref": self.operator_ref or None,
            "card_brand": self.card_brand or None,
            "card_last4": self.card_last4 or None,
            "verified_at": self.last_verified_at.isoformat() + "Z" if self.last_verified_at else None,
            "has_anomaly": bool(self.has_anomaly),
        }


class EdulocPaymentEvent(models.Model):
    _name = "eduloc.payment.event"
    _description = "Évènement de paiement EduLoc"
    _order = "create_date desc, id desc"

    _event_id_uniq = models.Constraint("UNIQUE(event_id)", "Évènement déjà enregistré.")

    payment_id = fields.Many2one("eduloc.payment", required=True, ondelete="cascade", index=True, readonly=True)
    event_id = fields.Char("Identifiant d'évènement", required=True, readonly=True)
    source = fields.Char("Source", readonly=True)
    type = fields.Char("Type", readonly=True)
    from_status = fields.Selection(STATUSES, "De", readonly=True)
    to_status = fields.Selection(STATUSES, "Vers", readonly=True)
    details = fields.Text("Détails (sans donnée sensible)", readonly=True)
