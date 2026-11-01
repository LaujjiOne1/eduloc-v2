from odoo import fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    eduloc_external_ref = fields.Char(
        string="Référence externe EduLoc",
        readonly=True,
        copy=False,
        index=True,
        help="Identifiant unique de la demande du site (support_requests). "
        "Garantit qu'une même soumission ne crée jamais deux pistes.",
    )
    eduloc_public_ref = fields.Char(
        string="Référence visiteur",
        readonly=True,
        copy=False,
        index=True,
        help="Référence affichée au visiteur à l'envoi du formulaire.",
    )
    eduloc_received_at = fields.Datetime(string="Reçue sur le site le", readonly=True, copy=False)
    eduloc_request_type = fields.Selection(
        [
            ("trouver_tuteur", "Trouver un tuteur pour soi"),
            ("cours_proche", "Cours pour un proche"),
            ("reservation", "Aide sur une réservation"),
            ("autre", "Autre question"),
        ],
        string="Type de demande",
        index=True,
    )
    eduloc_for_whom = fields.Char(string="Pour qui")
    eduloc_level = fields.Char(string="Niveau")
    eduloc_subject = fields.Char(string="Matière")
    eduloc_format = fields.Char(string="Format souhaité")
    eduloc_frequency = fields.Char(string="Fréquence souhaitée")
    eduloc_city = fields.Char(string="Ville / zone")
    eduloc_preferred_channel = fields.Char(string="Canal de contact préféré")
    eduloc_reservation_ref = fields.Char(
        string="Référence de réservation EduLoc",
        help="À renseigner quand la demande est convertie en réservation dans EduLoc.",
    )

    _eduloc_external_ref_uniq = models.Constraint(
        "UNIQUE(eduloc_external_ref)",
        "Une piste existe déjà pour cette référence externe EduLoc.",
    )
