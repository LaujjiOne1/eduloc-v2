# Documentation de pilotage EduLoc

Ce dossier organise le développement pour que les chantiers **ne s'emboîtent pas** (pas de collision de fichiers, pas de travail sur un
module dont la dépendance n'est pas prête). Il complète la spécification V2 du backend sans la remplacer.

## Ordre de lecture

| # | Document | Pour qui | Rôle |
|---|---|---|---|
| 1 | [`architecture/ARCHITECTURE-GLOBALE.md`](architecture/ARCHITECTURE-GLOBALE.md) | tous | Responsabilités des systèmes, principes, décisions ouvertes |
| 2 | [`workflows/WORKFLOWS.md`](workflows/WORKFLOWS.md) | tous | Machines d'états et séquences (réservation, paiement, clôture, téléphone, Odoo) |
| 3 | [`agents/AGENTS.md`](agents/AGENTS.md) | agents IA et humains | Rôles, périmètres de fichiers, règles anti-collision, protocole de passation |
| 4 | [`taches/ROADMAP-TACHES.md`](taches/ROADMAP-TACHES.md) | tous | Tâches ordonnées par vague, dépendances, critères de fin |
| 5 | [`tests/PLAN-DE-TESTS.md`](tests/PLAN-DE-TESTS.md) | dev / QA | Tests à écrire, dans l'ordre, par tâche |
| 6 | [`securite/SECURITE-BACKEND.md`](securite/SECURITE-BACKEND.md) | dev / sécurité | Exigences, contrôles CI, checklist de revue |
| 5b | [`tests/ROADMAP-TEST-SYSTEME.md`](tests/ROADMAP-TEST-SYSTEME.md) | QA / direction | Paliers de test de l’ensemble du système, du contrat au pilote |
| 5c | [`architecture/DECISIONS-A-TRANCHER.md`](architecture/DECISIONS-A-TRANCHER.md) | direction | 20 décisions à prendre avant d’implémenter, avec recommandations |
| 4b | [`taches/ORDRE-DE-DEVELOPPEMENT.md`](taches/ORDRE-DE-DEVELOPPEMENT.md) | tous | Ordre de développement après les décisions du 2026-11-01 |
| 7 | [`video/STORYBOARD-PRESENTATION.md`](video/STORYBOARD-PRESENTATION.md) | marketing / motion | Storyboard et direction motion design |

## CI/CD

Les pipelines sont dans [`.github/workflows/`](../.github/workflows) :

- `backend-ci.yml` : lint, build, tests unitaires, tests d'intégration (PostgreSQL + PostGIS + pgvector).
- `backend-security.yml` : audit des dépendances, secrets, CodeQL, scan d'image (Trivy), SBOM.
- `backend-cd.yml` : image Docker signée-traçable vers GHCR, déploiement staging automatique, production sur approbation.

## Règle d'or

Un chantier démarre seulement quand ses dépendances (colonne « Dépend de » de la roadmap) sont **fusionnées et vertes**.
Chaque chantier ne touche que les fichiers de son périmètre (voir `AGENTS.md`, §3).

## État des décisions

Les montants (frais de déplacement 1 500/2 500 Ar), taux de taxes et commissions sont des **hypothèses** : voir la section
« Décisions ouvertes » de l'architecture. Aucun code ne doit les figer en dur : ils vivent dans une table de paramètres versionnée.
