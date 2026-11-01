# Roadmap de test de l'ensemble du système

Complète `PLAN-DE-TESTS.md` (tests par tâche) : ici on teste **les systèmes ensemble**, du plus proche au plus large.
Chaque palier a une condition d'entrée, des scénarios, une condition de sortie. On ne passe au palier suivant que si le précédent est vert.

## Environnements

| Env | Contenu | Usage |
|---|---|---|
| Local | Docker Compose (API, base PostGIS, Redis, Centrifugo, LiveKit, Ollama), service de paiement en mode simulation (`pay-simulate`) | Dev, paliers P1-P3 |
| CI | Base jetable + services simulés | P1-P3 à chaque PR |
| Staging | Déploiement complet, Odoo de test, paiement en mode sandbox du prestataire, comptes fictifs | P4-P7 |
| Production | Réel | Pilote P8 uniquement |

Données : jeux fictifs uniquement (aucune donnée d'enfant réelle hors pilote consenti). Comptes types : 2 demandeurs (un avec bénéficiaire mineur),
3 tuteurs (actif, en attente de validation, suspendu), 1 partenaire avec salle, 1 admin Office, 2 conseillers (rôle `AGENT`).

## Paliers

### P0. Santé du socle (avant tout)
- Build, lint, tests unitaires et d'intégration existants verts ; `matching:eval` sans régression ; migrations rejouées depuis zéro.
- Sortie : CI verte sur `main`.

### P1. Contrats entre systèmes
Vérifier chaque interface isolément, avec des simulateurs de l'autre côté.
| Contrat | Vérifications |
|---|---|
| Application ↔ API | Schéma OpenAPI figé ; codes d'erreur ; l'application ne calcule ni prix ni statut |
| API ↔ Paiement | Ticket signé, webhook signé, rejeu, montant discordant, signature fausse |
| API ↔ Odoo | Événements signés, idempotence, indisponibilité d'Odoo, sens inverse par API uniquement |
| API ↔ Notifications | Livraison, échec, quotas |
Sortie : tests de contrat verts des deux côtés.

### P2. Parcours nominaux (un système à la fois)
| ID | Parcours |
|---|---|
| S-01 | Inscription tuteur → dossier → validation Office → visible en recherche |
| S-02 | Offre + tarif soumis → validé → publié |
| S-03 | Recherche (classique puis sémantique) : un tuteur non réservable n'apparaît jamais comme réservable |
| S-04 | Demande → acceptation → paiement → réservation confirmée |
| S-05 | Début → fin tuteur → confirmation bénéficiaire → clôture → calcul figé → reversement |
Sortie : 5 parcours verts sur staging par script automatisé (`npm run e2e`).

### P3. Parcours d'exception (le plus risqué)
| ID | Scénario | Attendu |
|---|---|---|
| X-01 | Demande expire (T1) | `EXPIRED`, tâche Odoo, renvoi possible |
| X-02 | Tuteur refuse | `REFUSED`, alternative proposée |
| X-03 | Paiement échoué puis réussi | Réservation confirmée une seule fois |
| X-04 | Deux demandeurs paient le même créneau (≥ 50 essais) | Un seul gagne, l'autre géré selon la décision D-04 |
| X-05 | Webhook rejoué / tardif / hors ordre | Aucun effet double |
| X-06 | Paiement après expiration T2 | Règle D-05 appliquée |
| X-07 | Tuteur termine, bénéficiaire ne répond pas | Règle D-08 |
| X-08 | Déconnexion des deux | Pas de clôture avant le délai D-09 |
| X-09 | Contestation | `DISPUTED`, reversement bloqué, dossier Odoo |
| X-10 | Dépassement de durée | Enregistré, aucun supplément sans D-10 |
| X-11 | Annulation par demandeur / tuteur / admin | Remboursement selon D-06 |
| X-12 | Tuteur suspendu avec réservations à venir | Traitement défini D-13 |
| X-13 | Changement de tarif après acceptation | Réservation inchangée |
| X-14 | Panne d'Odoo, du service de paiement, de Redis, d'Ollama | Dégradation prévue, `/health` correct, aucune perte d'événement |
Sortie : 100 % verts, test de concurrence stable sur 3 exécutions consécutives.

### P4. Canal téléphone (de bout en bout, avec Odoo)
| ID | Scénario |
|---|---|
| T-01 | Appel → fiche invité dans Odoo → recherche via API → demande créée par l'agent → suivi jusqu'à confirmation |
| T-02 | Lien de paiement envoyé, utilisé, expiré, réutilisé |
| T-03 | Agent tente d'accéder à des données hors périmètre |
| T-04 | Même demande faite par téléphone et par application : mêmes états et mêmes montants |
| T-05 | Doublon (même téléphone, même créneau) |
Sortie : un conseiller formé réalise T-01 sans aide, en moins de 10 minutes.

### P5. Opérations et service client
Relances (expirée, acceptée non payée, paiement échoué), rappels avant cours, suivi qualité après séance, réclamation de bout en bout
(ouverture → traitement → décision appliquée via l'API → reversement ajusté). Mesure : délai de traitement, aucune tâche dupliquée, aucune tâche oubliée.

### P6. Finance et réconciliation
- Rapprochement quotidien : paiements du prestataire = paiements EduLoc = écritures lisibles par Odoo.
- Cas : remboursement, litige, arrondi MGA, taxes, double commission impossible, frais de déplacement plafonnés.
- Sortie : écart zéro sur un jeu de 200 transactions simulées, validé par la personne responsable de la comptabilité.

### P7. Non-fonctionnel
| Domaine | Test | Seuil proposé (à confirmer) |
|---|---|---|
| Charge | 200 recherches/min, 30 réservations simultanées | p95 < 800 ms recherche |
| Concurrence | 100 paiements sur 10 créneaux | 0 double attribution |
| Sécurité | CI sécurité verte + test d'intrusion ciblé (IDOR, rôles, webhooks, téléversements) | 0 faille élevée |
| Reprise | Restauration d'une sauvegarde, redémarrage pendant un paiement | Données cohérentes, RPO ≤ 24 h |
| Réseau | Connexion lente / coupée (mobile) | Aucun double envoi, état relu au retour |
| Accessibilité | Écrans clés de l'application | Contraste AA, lecteur d'écran sur les parcours S-04/S-05 |
| Observabilité | Alertes sur paiements bloqués, tâche d'expiration arrêtée, file d'événements qui grossit | Alerte reçue en < 5 min |

### P8. Pilote réel
- Périmètre : 1 zone, 10 tuteurs validés, 30 demandeurs consentants, 2 conseillers, 4 semaines.
- Paiement réel à petits montants, reversement manuel supervisé la première semaine.
- Suivi quotidien : séances terminées, demandes expirées, taux de litige, délai de réponse, satisfaction.
- **Critères de passage en lancement** : ≥ 95 % de séances clôturées sans intervention, 0 double réservation, 0 écart financier non expliqué,
  litiges résolus < 72 h, aucune faille de sécurité ouverte.
- **Critères d'arrêt immédiat** : écart d'argent non expliqué, fuite de données, double attribution répétée.

## Calendrier indicatif (à recaler après les décisions)

| Semaine | Palier | Condition |
|---|---|---|
| 0-1 | P0 + décisions bloquantes | Document de décisions rempli |
| 2-4 | P1, P2 au fil des vagues 1-2 de la roadmap | Tâches T-BKG/T-PAY fusionnées |
| 5-7 | P3 | Vague 3 terminée |
| 8-9 | P4, P5 | Odoo + canal téléphone livrés |
| 10 | P6, P7 | Finance livrée |
| 11-14 | P8 pilote | Feu vert P0-P7 |

## Matrice de couverture (système × palier)

| Système | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| Backend | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Application | ✔ | ✔ | ✔ | | | | ✔ | ✔ |
| Office | | ✔ | ✔ | | ✔ | ✔ | | ✔ |
| Odoo | ✔ | | ✔ | ✔ | ✔ | ✔ | | ✔ |
| Paiement | ✔ | ✔ | ✔ | ✔ | | ✔ | ✔ | ✔ |
| Matching | ✔ | ✔ | | | | | ✔ | ✔ |
| Landing | | | | | | | ✔ | ✔ |

## Rapport de test (modèle)

```
Palier : P_   Date :   Version/commit :
Scénarios exécutés : n   Verts : n   Rouges : n   Ignorés : n (justification)
Défauts ouverts (gravité) :
Décision : passe / ne passe pas   Signé par :
```
