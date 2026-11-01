{
    "name": "EduLoc — Thème",
    "summary": "Charte graphique edUloc (couleurs, polices, logo, connexion) pour Odoo",
    "description": """
Applique à Odoo la charte de la landing edUloc : palette violet/émeraude sur fond papier,
Space Grotesk pour les titres et Inter pour l'interface, boutons en pilule, cartes arrondies,
page de connexion et logo de la société. Les polices (licence OFL) sont servies localement.
""",
    "version": "19.0.1.0.0",
    "category": "Hidden/Tools",
    "author": "EduLoc",
    "license": "LGPL-3",
    "depends": ["web"],
    "data": [
        "data/res_company_data.xml",
        "views/login_templates.xml",
    ],
    "assets": {
        "web._assets_primary_variables": [
            ("prepend", "eduloc_theme/static/src/scss/primary_variables.scss"),
        ],
        "web._assets_secondary_variables": [
            ("prepend", "eduloc_theme/static/src/scss/secondary_variables.scss"),
        ],
        "web.assets_backend": [
            "eduloc_theme/static/src/scss/fonts.scss",
            "eduloc_theme/static/src/scss/backend.scss",
        ],
        "web.assets_frontend": [
            "eduloc_theme/static/src/scss/fonts.scss",
            "eduloc_theme/static/src/scss/login.scss",
        ],
    },
    "installable": True,
    "application": False,
}
