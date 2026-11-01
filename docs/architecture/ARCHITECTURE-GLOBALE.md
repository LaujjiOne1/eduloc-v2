# EduLoc — Architecture globale (référence de pilotage)

Document de cadrage. Distinct de la spécification technique V2 du backend. À décomposer ensuite en : architecture fonctionnelle,
architecture technique, modèle opérationnel (Odoo), modèle économique.

## 1. Responsabilités des systèmes

| Système | Détient | Ne fait jamais |
|---|---|---|
| **Backend EduLoc** (NestJS / Prisma / PostgreSQL+PostGIS) | La vérité métier : identités, tuteurs, offres, tarifs, créneaux, réservations, paiements, séances, commissions | Déléguer un état métier à un autre système |
| **Application EduLoc** | L'accès utilisateur, l'affichage, la collecte de saisies | Être source de vérité (un écran « payé » ne prouve rien) |
| **Landing page** | Présentation, acquisition, formulaire d'assistance (`support_requests`) | Gérer des réservations |
| **EduLoc Office** (admin) | Supervision : validation tuteurs/offres/tarifs, conflits, indicateurs, paramètres | Écrire en base directement : API backend uniquement |
| **Odoo CRM** | Relation client : contacts, relances, tâches, réclamations, activités des conseillers | Stocker disponibilités, réservations ou états de séance (pas de second backend) |
| **Service de paiement** (`eduloc-pay-subscriptions`) | Encaissement Visa / Mobile Money, notification signée | Décider d'une réservation |
| **Service de matching** (Ollama / embeddings) | Pertinence sémantique | Rendre un tuteur réservable |

## 2. Principes (non négociables)

1. Une seule source de vérité métier : le backend.
2. Zéro double réservation : attribution du créneau **atomique** (contrainte d'exclusion `btree_gist` + transaction) au premier paiement validé.
3. Un seul workflow de réservation, deux canaux (application, téléphone). Odoo appelle l'API EduLoc.
4. Paiement client, commission et reversement tuteur sont trois opérations distinctes, tracées.
5. Les permissions sont vérifiées côté backend (RBAC + propriété de la ressource), jamais côté client.
6. Tout changement d'état important écrit un événement (`BookingEvent`, `PaymentEvent`, outbox).
7. Les intégrations passent par des événements signés et idempotents (outbox → Odoo).
8. Les paramètres commerciaux sont des données versionnées, pas des constantes.

## 3. Cartographie des domaines et des modules existants

| Domaine | Module backend | Statut d'après le dépôt |
|---|---|---|
| Identité / rôles | `auth`, `users` | présent |
| Bénéficiaires | `beneficiaries` | présent |
| Tuteurs, dossiers, CV | `tutors`, `cv-import` | présent |
| Catalogue, offres | `catalog` | présent |
| Lieux et salles partenaires | `partners`, `rooms`, `geo` | présent |
| Recherche / matching | `search`, `matching` | présent |
| Réservations | `bookings` (+ `BookingHold`, `BookingEvent`) | présent, à compléter (expiration, paiement concurrent) |
| Paiements | `payments` | présent, désactivé par `PAYMENTS_ENABLED` |
| Séances / clôture | `bookings`, `realtime` | à compléter (double validation) |
| Messagerie / appels | `communication`, `realtime` | présent |
| Notifications | `notifications` (outbox) | présent |
| Administration | `admin` | présent |
| Réclamations / conflits | `Conflict` (schéma) | partiel |
| Réservation téléphonique | — | à créer |
| Finance (commissions, reversements) | — | à créer |
| Intégration Odoo | — | à créer (voir `odoo integration.md`) |
| Analytique | — | à créer (phase 5) |

## 4. Décisions ouvertes (à trancher avant le chantier concerné)

| Sujet | Décision | Bloque |
|---|---|---|
| Frais de déplacement | Forfait (1 500 Ar, plafond 2 500 Ar ?) ou distance ou réel ; rôle du taxi | T-FIN-01 |
| Taxes client / tuteur, commission, frais de service | Taux, assiette, qui paie quoi (éviter la double commission) | T-FIN-01 |
| Expiration d'une demande | Durées proposées (15 min, 30 min, 1 h, personnalisée) | T-BKG-02 |
| Délai de paiement après acceptation | Durée ; sort du créneau à l'expiration | T-BKG-03 |
| Second paiement concurrent | Remboursement automatique ou proposition d'un autre créneau | T-BKG-03 |
| Clôture avec bénéficiaire mineur | Qui confirme (responsable légal) ; règle alternative | T-SES-02 |
| Délai de grâce après déconnexion | Valeur et règle de clôture automatique | T-SES-03 |
| Dépassement de durée | Supplément facturé ou non, consentement | T-SES-04 |
| Désaccord après séance | Procédure, délais, preuves conservées | T-SES-05 |
| Réservation téléphonique | Données minimales, identification du demandeur sans compte | T-TEL-01 |
| Odoo | Modules, version (19 Community prévue), niveau d'intégration | T-ODO-01 |
| Indicateurs analytiques | Seuils et alertes | phase 5 |

## 5. Flux entre systèmes

| Opération | Responsable | Secondaire |
|---|---|---|
| Recherche / matching | Backend | Application |
| Créneaux | Backend | Odoo en lecture |
| Réservation (app) | Backend | Application |
| Réservation (téléphone) | Backend via API | Odoo (interface conseiller) |
| Validation tuteurs | Office → Backend | — |
| Paiement | Service de paiement | Backend (vérifie) |
| Commissions | Backend finance | Odoo (lecture) |
| Clôture de séance | Backend | Application |
| Suivi client, relances, réclamations | Odoo | Backend (événements) |
| Analyse | Environnement analytique | Backend / Odoo |

## 6. Phases

1. Architecture métier (domaines, règles, machines d'états) : `workflows/WORKFLOWS.md`.
2. Architecture technique (modèle, API, événements, contrats Odoo et paiement).
3. Noyau : tuteurs, offres, créneaux, matching, réservations, paiements, séances, rémunérations.
4. Intégration opérationnelle : Office, Odoo, téléphone, relances, réclamations.
5. Qualité et pilotage : événements, indicateurs, alertes.

Le détail exécutable est dans `taches/ROADMAP-TACHES.md`.
