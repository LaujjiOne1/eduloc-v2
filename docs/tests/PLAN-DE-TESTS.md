# Plan de tests (dans l'ordre d'exécution des tâches)

Outillage existant du backend : tests unitaires `npm test` (runner natif Node + tsx, `test/unit`), intégration `npm run test:int`
(`test/integration`, base jetable `db-test` avec PostGIS, btree_gist, pgvector via `TEST_DATABASE_URL`), évaluation du matching
`npm run matching:eval`, parcours de bout en bout `npm run e2e`.

Convention : `TP-<DOMAINE>-NN`. Niveau : **U** unitaire, **I** intégration (base réelle), **E** bout en bout.
Un test de règle critique est écrit **avant** le code (rouge dans la PR).

## Ordre de passage

1. U (rapides, à chaque commit) → 2. I (à chaque PR) → 3. E (avant fusion en `main` et avant déploiement staging) → 4. Sécurité (CI dédiée).

## T-FIN-01 / T-FIN-02 : calcul financier

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-FIN-01 | U | Prix = tarif × durée + déplacement + frais | Montants exacts, sans flottant |
| TP-FIN-02 | U | Déplacement au-dessus du plafond | Plafonné |
| TP-FIN-03 | U | Cours en ligne | Pas de frais de déplacement |
| TP-FIN-04 | U | Commission appliquée une seule fois | Pas de double prélèvement |
| TP-FIN-05 | U | Arrondis (MGA) | Somme des lignes = total |
| TP-FIN-06 | I | Changement de paramètre après réservation | Réservation existante inchangée |
| TP-FIN-07 | I | `Settlement` créé à la clôture seulement | Aucun reversement avant `COMPLETED` |
| TP-FIN-08 | I | Rejeu du calcul | Même résultat, un seul `Settlement` |
| TP-FIN-09 | I | Séance `DISPUTED` | Reversement bloqué |
| TP-FIN-10 | I | Remboursement | Écritures distinctes et traçables |

## T-OBX-01 / T-AUD-01 : événements et audit

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-OBX-01 | I | Événement écrit dans la même transaction que le changement d'état | Atomique : tout ou rien |
| TP-OBX-02 | I | Échec de livraison | Reprise avec retard croissant, pas de perte |
| TP-OBX-03 | I | Livraison en double | Récepteur idempotent par `event_id` |
| TP-OBX-04 | U | Signature HMAC | Rejet si invalide ou horodatage trop ancien |
| TP-AUD-01 | I | Action d'un agent/admin | Acteur, rôle, cible, avant/après enregistrés |
| TP-AUD-02 | I | Journal en lecture seule | Aucune route de modification |

## T-BKG-* : réservation

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-BKG-01 | U | Toutes les transitions légales | Acceptées |
| TP-BKG-02 | U | Toutes les transitions illégales (ex. `COMPLETED → PENDING`) | Refusées |
| TP-BKG-03 | I | Qui peut faire quoi (demandeur, tuteur, admin, agent) | 403 hors rôle ou propriété |
| TP-BKG-04 | I | Chaque transition écrit `BookingEvent` | Présent, ordre correct |
| TP-BKG-05 | I | Demande expirée | `EXPIRED`, conservée en historique |
| TP-BKG-06 | I | Tâche d'expiration exécutée deux fois / deux instances | Aucun effet double |
| TP-BKG-07 | I | Renvoi après expiration | Nouvelle demande liée, paramètres modifiables |
| TP-BKG-08 | I | Acceptation sans paiement | Créneau **non** attribué définitivement |
| TP-BKG-09 | I | Premier paiement validé | `CONFIRMED`, créneau attribué |
| TP-BKG-10 | I | Deux paiements simultanés (≥ 50 itérations) | Exactement un `CONFIRMED` |
| TP-BKG-11 | I | `T2` écoulé | `EXPIRED`, créneau libéré |
| TP-BKG-12 | I | Chevauchement avec réservation existante | Rejeté par contrainte base, pas seulement par le code |

## T-PAY-01 : paiement

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-PAY-01 | U | Ticket : `alg` ≠ HS256, `none`, expiré, mauvais `aud`/`iss` | Rejeté |
| TP-PAY-02 | I | Webhook sans signature ou signature fausse | 401, aucun changement |
| TP-PAY-03 | I | Webhook rejoué | Sans effet |
| TP-PAY-04 | I | Webhook reçu après expiration | Reprise si libre, sinon remboursement + événement |
| TP-PAY-05 | I | Montant du webhook ≠ montant attendu | Rejeté, alerte |
| TP-PAY-06 | I | Statut revérifié serveur à serveur | Prime sur l'affirmation du client |
| TP-PAY-07 | I | `PAYMENTS_ENABLED=false` | 503 `PAYMENTS_UNAVAILABLE` |

## T-SES-* : séance et clôture

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-SES-01 | I | Début de séance | Heure serveur enregistrée, client non cru |
| TP-SES-02 | I | Début hors fenêtre autorisée | Refusé |
| TP-SES-03 | I | Présence/absence | Événements enregistrés |
| TP-SES-04 | I | Tuteur termine, bénéficiaire confirme | `COMPLETED` |
| TP-SES-05 | I | Tuteur termine, personne ne répond, délai écoulé | Règle décidée appliquée |
| TP-SES-06 | I | Bénéficiaire mineur | Confirmation par le responsable |
| TP-SES-07 | I | Déconnexion des deux | Pas de clôture avant le délai de grâce |
| TP-SES-08 | I | Reconnexion pendant le délai | Séance continue |
| TP-SES-09 | I | Clôture automatique | Auteur = SYSTEM, motif conservé |
| TP-SES-10 | I | Dépassement de durée | Enregistré, aucun supplément généré |
| TP-SES-11 | I | Contestation | `DISPUTED`, reversement bloqué |
| TP-SES-12 | I | Décision (libérer / ajuster / suspendre) | Montants cohérents, audit |
| TP-SES-13 | I | Clôture par un tiers non autorisé | 403 |

## T-TEL-* : canal téléphone

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-TEL-01 | I | Agent crée une réservation pour un invité sans compte | Même machine d'états que l'app |
| TP-TEL-02 | I | Agent hors périmètre (données d'autrui sans lien) | 403 |
| TP-TEL-03 | I | Données minimales manquantes | 422 explicite |
| TP-TEL-04 | I | Doublon (même téléphone, même créneau) | Détecté |
| TP-TEL-05 | I | Audit | Agent et invité tracés |
| TP-TEL-06 | I | Un invité ne voit que sa réservation | Pas d'énumération |
| TP-TEL-07 | I | Lien de paiement à usage unique, expirant | Réutilisation refusée |
| TP-TEL-08 | I | Paiement par lien | Mêmes règles que TP-BKG-09/10 |

## T-ODO-* : intégration Odoo

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-ODO-01 | I | `booking.expired` | Une seule tâche de relance |
| TP-ODO-02 | I | Événement rejoué | Pas de doublon |
| TP-ODO-03 | I | Odoo indisponible | Reprise sans perte |
| TP-ODO-04 | U | Signature invalide | Rejet |
| TP-ODO-05 | I | Règle de relance désactivée | Aucune tâche |
| TP-ODO-06 | I | Odoo ne peut pas modifier un créneau directement | Seule l'API EduLoc écrit |
| TP-ODO-07 | I | `session.disputed` | Dossier créé avec priorité |
| TP-ODO-08 | I | Décision saisie dans Odoo | Appliquée via l'API, auditée |

## T-OFF-*, T-APP-*, T-ANA-*

| ID | Niv | Cas | Attendu |
|---|---|---|---|
| TP-OFF-01 | E | Tuteur validé / refusé / suspendu | Visible ou masqué en recherche |
| TP-OFF-02 | E | Tarif en attente | Non publié avant validation |
| TP-OFF-03 | E | Modification de paramètre | Versionnée, n'affecte pas l'existant |
| TP-OFF-04..06 | E | Supervision, litiges, transactions | Actions possibles selon le rôle admin |
| TP-APP-01..05 | E | Écrans : attente, expiration, paiement, séance en cours, clôture | Affichent l'état **lu du backend** |
| TP-ANA-01 | I | Événements analytiques | Pas de donnée personnelle superflue |

## Non-régression permanente

`matching:eval` ne doit pas régresser ; `tutor-suspension`, `pricing-holds`, `availability-validation`, `payments` (déjà présents) restent verts.

## Critères d'entrée / sortie

- Entrée d'une vague : base `db-test` reconstruite depuis les migrations (`prisma migrate deploy`), seed minimal.
- Sortie : 0 test rouge, 0 test ignoré sans justification, couverture des tests de concurrence stable (aucun flaky toléré).
