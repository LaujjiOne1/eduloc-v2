# Agents : rôles, périmètres et protocole anti-collision

Valable pour des agents IA comme pour des développeurs humains. Un « agent » = un rôle avec un périmètre de fichiers exclusif.

## 1. Règles communes

1. Lire dans l'ordre : architecture, workflows, la tâche (`ROADMAP-TACHES.md`), le plan de tests correspondant.
2. Ne démarrer une tâche que si ses dépendances sont **fusionnées et vertes**.
3. Ne modifier que les fichiers du périmètre de son rôle (§3). Besoin d'un fichier hors périmètre : ouvrir une demande, ne pas le faire.
4. Une tâche = une branche = une PR. Nom : `feat/T-XXX-court`. Commits courts, un sujet chacun.
5. Les migrations Prisma sont **séquentielles et réservées** (§4). Jamais de modification d'une migration déjà fusionnée.
6. Tests d'abord pour les règles métier critiques (créneaux, paiement, clôture) : le test rouge est dans la PR avant le code.
7. Aucun secret, aucune donnée réelle dans le dépôt, les logs ou les fixtures.
8. Ne pas inventer de règle commerciale : si c'est une décision ouverte (architecture §4), s'arrêter et demander.
9. Fin de tâche : critères de fin cochés, tests listés exécutés, note de passation (§5).

## 2. Les rôles

| Rôle | Mission | Ne fait jamais |
|---|---|---|
| **A1 Architecte métier** | Règles, machines d'états, décisions ouvertes, contrats d'événements | Écrire du code applicatif |
| **A2 Backend noyau** | Réservations, paiements, séances, finance dans NestJS / Prisma | Toucher aux fronts ou à Odoo |
| **A3 Backend intégration** | Outbox, connecteur Odoo, webhooks, API agent téléphonique | Changer les règles de réservation |
| **A4 Odoo** | Module d'intégration Odoo, vues conseiller, règles de relance | Stocker des états métier |
| **A5 Front application** | Écrans application mobile (`edUloc front`) | Calculer un prix ou décider d'un état |
| **A6 Office** | Admin (`eduloc-admin`) : validations, paramètres, supervision | Accéder à la base |
| **A7 QA** | Plan de tests, tests d'intégration et end-to-end, jeux de données | Corriger le code testé sans passer par la tâche |
| **A8 Sécurité / DevOps** | CI/CD, secrets, durcissement, revues sécurité | Changer la logique métier |
| **A9 Contenu et motion** | Storyboard, animation, landing | Toucher au backend |

## 3. Périmètres de fichiers (monorepo)

| Rôle | Écrit dans |
|---|---|
| A1 | `docs/**` |
| A2 | `edUloc back/eduloc-backend/src/modules/{bookings,payments,finance,sessions}/**`, tests associés |
| A3 | `.../src/modules/{integrations,outbox,agent-booking}/**`, `.../src/infrastructure/**` |
| A4 | `eduloc-landing/odoo/**` (ou dossier Odoo dédié) |
| A5 | `edUloc front/**` |
| A6 | `eduloc-admin/**` |
| A7 | `.../test/**`, `.../eval/**`, `.../scripts/e2e*` |
| A8 | `.github/**`, `.../Dockerfile`, `.../docker*`, `docs/securite/**` |
| A9 | `docs/video/**`, `eduloc-landing/**` (hors `odoo/`) |

Fichiers **partagés sensibles** (un seul propriétaire à la fois, verrou déclaré dans la PR) :
`prisma/schema.prisma`, `src/app.module.ts`, `package.json`/lockfile, `.github/workflows/*`.

## 4. Migrations et contrats : comment éviter les emboîtements

- Les numéros de migration sont attribués par la roadmap (colonne « Migration »). Pas de migration hors tâche.
- `schema.prisma` : une seule PR de schéma ouverte à la fois. La suivante se rebase après fusion.
- Les contrats (DTO, événements Odoo, webhooks) sont versionnés dans `docs/` **avant** le code qui les produit ou les consomme.
- Un changement de contrat = nouvelle version (`v2`), l'ancienne reste servie jusqu'à ce que tous les consommateurs aient migré.
- Toute fonctionnalité nouvelle derrière un drapeau (`*_ENABLED`) tant qu'elle n'est pas complète, comme `PAYMENTS_ENABLED`.

## 5. Note de passation (fin de tâche)

À mettre dans la description de PR :

```
Tâche : T-XXX
Fait : …
Pas fait / reporté : …
Migrations : …
Variables d'environnement ajoutées : …
Tests exécutés : …
Risques / points pour la tâche suivante : …
```

## 6. Consignes de départ par rôle (à coller dans le prompt d'un agent)

**A2 Backend noyau** : « Tu es A2. Tu implémentes uniquement la tâche T-XXX de `docs/taches/ROADMAP-TACHES.md`, en respectant
`docs/workflows/WORKFLOWS.md`. Écris d'abord les tests du plan `docs/tests/PLAN-DE-TESTS.md`. Toute opération multi-étapes sur créneau
ou argent est dans une transaction. N'ajoute aucune règle commerciale non décidée. Ne modifie pas de fichier hors de ton périmètre. »

**A4 Odoo** : « Tu es A4. Odoo ne stocke ni disponibilité ni état de réservation. Toute action métier passe par l'API EduLoc avec un
jeton de rôle AGENT. Les événements reçus sont idempotents (`event_id`). »

**A8 Sécurité** : « Tu es A8. Tu fais échouer la CI plutôt que d'ignorer une alerte. Aucune exception sans entrée datée dans
`docs/securite/SECURITE-BACKEND.md` §7. »
