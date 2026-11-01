from . import controllers
from . import models


def post_init_hook(env):
    """Retire les étapes CRM livrées par défaut quand elles ne servent à rien.

    Sans équipe, elles apparaîtraient dans le pipeline EduLoc à côté des
    étapes du cahier. Une étape déjà utilisée par une piste est conservée.
    """
    stock = env["crm.stage"]
    for xmlid in ("stage_lead1", "stage_lead2", "stage_lead3", "stage_lead4"):
        stage = env.ref(f"crm.{xmlid}", raise_if_not_found=False)
        if stage and not stage.team_ids and not env["crm.lead"].with_context(active_test=False).search_count(
            [("stage_id", "=", stage.id)]
        ):
            stock |= stage
    stock.unlink()
