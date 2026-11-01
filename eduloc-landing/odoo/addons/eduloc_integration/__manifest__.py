{
    "name": "EduLoc — Intégration site vitrine",
    "summary": "Reçoit les demandes du site EduLoc et les transforme en pistes CRM",
    "description": """
Reçoit les demandes de l'assistant guidé du site vitrine (table support_requests)
via un endpoint sécurisé, crée ou retrouve le contact, crée une piste CRM
idempotente (référence externe unique) et fournit le pipeline, l'équipe et les
motifs de clôture du cahier « odoo integration.md ».
""",
    "version": "19.0.1.0.0",
    "category": "Sales/CRM",
    "author": "EduLoc",
    "license": "LGPL-3",
    "depends": ["crm", "contacts", "utm"],
    "data": [
        "data/crm_team_data.xml",
        "data/crm_stage_data.xml",
        "data/crm_lost_reason_data.xml",
        "data/crm_tag_data.xml",
        "data/utm_source_data.xml",
        "data/res_users_data.xml",
        "views/crm_lead_views.xml",
    ],
    "post_init_hook": "post_init_hook",
    "installable": True,
    "application": False,
}
