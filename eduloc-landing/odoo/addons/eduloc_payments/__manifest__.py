{
    "name": "EduLoc — Paiements",
    "summary": "Enregistre dans le CRM les paiements encaissés par le service de paiement EduLoc",
    "description": """
Le service de paiement EduLoc (eduloc-pay-subscriptions) n'a ni base de données ni stockage local : chaque paiement est
enregistré ici, dans le CRM, par un endpoint sécurisé. Le module ne reçoit jamais de donnée de carte ni de code secret
(références techniques seulement : transaction, marque et quatre derniers chiffres). Les agents consultent ; ils ne peuvent
pas modifier un statut à la main (seul le service de paiement, authentifié, fait évoluer un paiement, selon des règles fixes).
""",
    "version": "19.0.1.0.0",
    "category": "Sales/CRM",
    "author": "EduLoc",
    "license": "LGPL-3",
    "depends": ["crm", "mail"],
    "data": [
        "security/ir.model.access.csv",
        "views/payment_views.xml",
    ],
    "installable": True,
    "application": False,
}
