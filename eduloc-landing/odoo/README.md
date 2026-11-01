# Odoo CRM — intégration du site vitrine EduLoc

Met en œuvre `odoo integration.md` (racine du dépôt) : Odoo 19 Community auto-hébergé reçoit les
demandes de l'assistant guidé du site et les transforme en pistes CRM traitées par 2 à 5 agents.

```
Visiteur ─▶ GuidedAssistant ─▶ support_requests ──(déclencheur)──▶ odoo_sync_logs  PENDING
                                                                         │ chaque minute
                                    fonction Edge `odoo-sync` ◀──────────┘
                                         │ POST + Bearer
                                         ▼
                      Odoo  /eduloc/api/v1/support-requests  ─▶ contact + piste CRM
```

Le formulaire n'attend jamais Odoo : la demande est enregistrée d'abord, la transmission est asynchrone
et rejouable sans doublon.

| Dossier | Contenu |
| --- | --- |
| `compose.yml`, `config/odoo.conf`, `nginx/` | Odoo 19 + PostgreSQL 16 (+ Nginx HTTPS, profil `prod`) |
| `addons/eduloc_integration/` | Module Odoo : endpoint, champs, pipeline, équipe, motifs, compte technique, tests |
| `addons/eduloc_theme/` | Module Odoo : charte graphique edUloc (couleurs, polices, logo, connexion), tests |
| `scripts/backup.sh`, `scripts/restore.sh` | Sauvegarde / restauration base + filestore |
| `../landing page/supabase/` | Migration `odoo_sync_logs`, fonction Edge `odoo-sync`, tests Deno/Node |

## 1. Démarrage local

```bash
cd eduloc-landing/odoo
cp .env.example .env            # POSTGRES_PASSWORD et EDULOC_API_TOKEN : openssl rand -hex 32
docker compose up -d db

# Création de la base « eduloc » (list_db est désactivé : pas d'écran de création) + module
docker compose run --rm odoo -d eduloc -i eduloc_integration,eduloc_theme --without-demo=all --load-language=fr_FR --stop-after-init

# Une base créée en ligne de commande a l'admin « admin / admin » : à remplacer tout de suite
printf "%s\n" "env.ref('base.user_admin').password = 'MOT_DE_PASSE_ROBUSTE'" "env.cr.commit()" \
  | docker compose run --rm -T odoo odoo shell -d eduloc --no-http --workers=0

docker compose up -d odoo       # http://127.0.0.1:8069
```

Sous Git Bash (Windows), préfixer les commandes `docker compose run` contenant un `/chemin` par
`MSYS_NO_PATHCONV=1`. Dans `config/odoo.conf`, remplacer `admin_passwd` (master password) avant toute
mise en ligne.

## 2. Mise en production (VPS)

1. Docker + plugin Compose installés, un nom de domaine pointant sur le VPS, ports 80/443 ouverts,
   8069 et 5432 **fermés** (Odoo n'écoute que sur 127.0.0.1, PostgreSQL n'est pas publié).
2. Certificat : `certbot certonly --standalone -d crm.example.com` (avant de lancer Nginx), puis
   `ODOO_DOMAIN=crm.example.com` et `LETSENCRYPT_DIR=/etc/letsencrypt` dans `.env`.
   Renouvellement : tâche cron `certbot renew && docker compose --profile prod restart nginx`.
3. `docker compose --profile prod up -d`.
4. Planifier `scripts/backup.sh` (cron quotidien) et copier `backups/` hors du VPS.

Nginx bloque `/web/database/*`, force HTTPS et transmet `X-Forwarded-*` (`proxy_mode = True`).

Comportement au démarrage (`restart: always`) :

- **Sans certificat** dans `LETSENCRYPT_DIR/live/<domaine>/`, Nginx refuse de démarrer
  (`cannot load certificate`) et redémarre en boucle. C'est voulu : jamais d'Odoo servi en clair.
  Il suffit d'obtenir le certificat (étape 2), Nginx démarre au tentative suivante.
- **Odoo arrêté ou en cours de redémarrage** : Nginx reste actif et répond `502` jusqu'au retour d'Odoo
  (résolution DNS à la requête). Vérifié : démarrage de Nginx avant Odoo, 0 redémarrage.
- Pour un essai local avec un certificat auto-signé, retirer ensuite le conteneur
  (`docker compose --profile prod rm -sf nginx`) : le simple `stop` laisse Docker le relancer, et
  sans le certificat il boucle.

## 3. Configuration du CRM (à faire dans Odoo)

Le module installe : l'équipe **EduLoc — Relation client**, le pipeline (Nouvelle demande → À qualifier →
En recherche → Proposition envoyée → En attente → Convertie), 7 motifs de clôture, un tag par type de
demande, la source « Site vitrine EduLoc » et le compte technique `eduloc_gateway`.

À créer à la main (ce sont des personnes réelles), un compte par agent :

| Rôle du cahier | Groupe Odoo à cocher (Paramètres ▸ Utilisateurs ▸ Ventes) |
| --- | --- |
| Agent | **Utilisateur : documents personnels uniquement** — voit ses pistes et les pistes non assignées |
| Responsable relation client | **Administrateur** (ventes) — voit tout, attribue, configure le CRM, sans droits système |
| Administrateur Odoo | Droits d'accès **Paramètres** — réservé à l'administrateur technique |

Ajouter les agents à l'équipe (CRM ▸ Configuration ▸ Équipes commerciales). L'attribution est manuelle : une
nouvelle demande arrive **non assignée** dans « Nouvelle demande » et le responsable (ou l'agent qui la
prend) renseigne le champ *Commercial*.

## 3 bis. Thème edUloc (`eduloc_theme`)

Reprend la charte de la landing (`landing page/src/index.css`, `Logo.tsx`) : l'interface n'a plus d'Odoo que
le fonctionnement.

| Élément | Rendu |
| --- | --- |
| Couleurs | primaire `#332E86`, violet `#8D7FE3`, émeraude `#0E9C82` (succès), ambre `#BD7E28`, rouge `#AC4A40`, fond papier `#FAF9F4`, filets `#E7E3D7`, encre `#14162B` |
| Polices | Inter (interface) et Space Grotesk 700 (titres), servies localement (OFL, pas d'appel à Google Fonts) |
| Formes | boutons en pilule, cartes kanban 12 px, fiche et fenêtres 16 px, ombre douce violette |
| Barre de navigation | claire comme l'en-tête de la landing, filet dégradé de marque en dessous |
| Étiquettes | « teinte + encre » comme les badges de la landing |
| Connexion | carte blanche sur halos violet/émeraude, logo, baseline « Le bon accompagnement, au bon endroit. », « Généré par Odoo » retiré |
| Société | logo (PNG généré depuis `Logo.tsx`) utilisé aussi dans les e-mails et rapports ; icône d'onglet ; titre d'onglet « edUloc » |

Pour changer une couleur : `static/src/scss/primary_variables.scss` (une seule source), puis
`docker compose run --rm odoo -d eduloc -u eduloc_theme --stop-after-init` et rechargement du navigateur
(Ctrl+F5). Le logo et les couleurs de la société sont posés à l'installation seulement (`noupdate`) : une
modification faite ensuite dans Paramètres ▸ Société n'est pas écrasée.

Limites : pas de mode sombre (Odoo Community n'en a pas) ; les rapports PDF gardent la mise en page standard
d'Odoo avec le logo et la couleur de la société ; le guide d'accueil d'Odoo (bulle sur une base neuve) reste en anglais/standard.

## 4. Contrat d'API

`POST {ODOO_URL}/eduloc/api/v1/support-requests` — `Authorization: Bearer <EDULOC_API_TOKEN>`, JSON, ≤ 64 Ko.

```json
{
  "external_reference": "EDULOC-SUPPORT-<uuid de support_requests.id>",
  "public_reference": "A1B2C3D4",
  "received_at": "2026-10-30T09:15:00+00:00",
  "category": "trouver_tuteur | cours_proche | reservation | autre",
  "full_name": "Awa Diallo", "phone": "06 12 34 56 78", "email": "awa@example.com",
  "preferred_channel": "WhatsApp", "message": "…",
  "details": { "pour": "", "niveau": "", "matiere": "", "format": "", "frequence": "", "ville": "", "sujet": "", "reference": "" }
}
```

| Réponse | Sens | La passerelle… |
| --- | --- | --- |
| `201` `{status:"created", lead_id, partner_id, external_reference}` | piste créée | passe à `SUCCESS` |
| `200` `{status:"existing", …}` | même `external_reference` déjà reçue (rejeu) | passe à `SUCCESS` |
| `400` / `413` / `422` `{error:{code,message}}` | requête invalide | `FAILED`, **pas de reprise auto** |
| `401`, `503`, `5xx`, réseau, délai | jeton/config/indisponibilité | `FAILED`, reprise à 1 min, 5 min, 15 min, 1 h, 3 h, 12 h… |

Rapprochement du contact : e-mail normalisé, puis téléphone normalisé (9 derniers chiffres, insensible au
format et au préfixe pays), sinon nouveau contact. Un contact retrouvé n'est jamais modifié, sauf pour
compléter un e-mail ou un téléphone manquant. Chaque soumission crée **sa propre piste**, même pour un
contact existant. Les coordonnées telles que saisies restent dans la description de la piste.

## 5. Côté Supabase (site)

1. Appliquer `landing page/supabase/migrations/20261030000000_odoo_sync_logs.sql`.
   Les demandes **déjà présentes ne sont pas envoyées** (elles peuvent contenir des essais) ; la requête
   de rattrapage est en commentaire dans la migration.
2. Secrets de la fonction : `ODOO_URL` (ex. `https://crm.example.com`), `ODOO_API_TOKEN` (= `EDULOC_API_TOKEN`
   d'Odoo) et `LOVABLE_CRON_SECRET` (déjà utilisé par `_shared/cron-auth.ts`).
3. Déployer `functions/odoo-sync` et le planifier **toutes les minutes** en `POST` avec
   `Authorization: Bearer <LOVABLE_CRON_SECRET>`.
4. Supervision (SQL, rôle `service_role`) :
   ```sql
   select external_reference, sync_status, attempt_count, last_error, next_attempt_at
   from odoo_sync_logs where sync_status <> 'SUCCESS' order by created_at;
   ```
   `FAILED` avec `next_attempt_at` nul = reprise automatique épuisée ou erreur de données : corriger puis
   relancer à la main : `POST odoo-sync {"support_request_id": "<uuid>"}` (même secret).

## 6. Décisions et écarts par rapport au cahier

- **API : module personnalisé (option B).** JSON-2 est soumis à restriction selon le plan Odoo ; Community
  n'est pas garanti d'y avoir accès. L'endpoint maison fonctionne sur Community.
- **« Sans suite » n'est pas une étape.** C'est l'action native **Perdu**, qui impose un motif et archive le
  dossier ; une étape permettrait de clore sans motif. Les 7 motifs sont modifiables dans CRM ▸ Configuration.
- **Référence externe = `EDULOC-SUPPORT-<uuid>`**, pas un numéro séquentiel `…-2026-000123` : le site écrit
  en anonyme sans pouvoir lire la table, un compteur y serait fragile. La référence montrée au visiteur
  (8 premiers caractères de l'UUID) est copiée dans le titre de la piste (`[A1B2C3D4] …`) et dans un champ
  recherchable : un agent retrouve la demande dont parle le visiteur.
- **Étapes CRM d'origine supprimées** (`New/Qualified/Proposition/Won`) quand aucune piste ne les utilise,
  pour ne pas les mélanger au pipeline EduLoc.
- **Compte technique** `eduloc_gateway` : groupes *Ventes – documents personnels* + *Création de contacts*,
  sans mot de passe (aucune connexion possible), non administrateur (vérifié par test).
- Aucune donnée de bénéficiaire mineur n'est collectée : le site ne demande que le demandeur.

## 7. Tests

```bash
# Odoo (29 tests : 24 intégration — modèle, anti-doublon, idempotence, rôles, API HTTP — et 5 thème)
MSYS_NO_PATHCONV=1 docker compose run --rm odoo -d eduloc -u eduloc_integration,eduloc_theme \
  --test-enable --test-tags /eduloc_integration,/eduloc_theme --workers=0 --stop-after-init

# Passerelle (16 tests)
cd "../landing page" && node --test supabase/functions/_shared/odoo-mapping.test.ts supabase/functions/_shared/odoo-sync.test.ts
```

## 8. Non vérifié

- La fonction Edge `odoo-sync/index.ts` passe `deno check` mais n'a pas été exécutée contre un vrai projet
  Supabase (les 16 tests portent sur la logique et le client HTTP, validés contre un vrai Odoo).
- Let's Encrypt et la tâche planifiée Supabase n'ont pas été essayés ; Nginx l'a été avec un certificat
  auto-signé.
- Pas de notification automatique à l'arrivée d'une demande non assignée (hors périmètre de la phase 1).
- Politique de conservation des demandes (cahier §12) : à définir ; la clé étrangère `RESTRICT` impose de
  supprimer la ligne de `odoo_sync_logs` avant celle de `support_requests`.
