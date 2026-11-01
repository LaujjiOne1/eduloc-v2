import re

from odoo import api, fields, models

PHONE_KEY_LENGTH = 9


def phone_key(value):
    """Clé de rapprochement d'un numéro : ses derniers chiffres significatifs.

    Insensible aux espaces, points, parenthèses, au préfixe pays (+33, 0033) et
    au 0 national. Un numéro trop court est ambigu : il n'a pas de clé.
    """
    digits = re.sub(r"\D", "", value or "")
    if len(digits) < PHONE_KEY_LENGTH:
        return False
    return digits[-PHONE_KEY_LENGTH:]


class ResPartner(models.Model):
    _inherit = "res.partner"

    eduloc_phone_key = fields.Char(
        compute="_compute_eduloc_phone_key",
        store=True,
        index="btree_not_null",
        help="Numéro normalisé, utilisé pour retrouver un contact existant.",
    )

    @api.depends("phone")
    def _compute_eduloc_phone_key(self):
        for partner in self:
            partner.eduloc_phone_key = phone_key(partner.phone)
