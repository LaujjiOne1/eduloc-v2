# Ordre de développement (après les décisions du 2026-11-01)

Remplace l'ordonnancement de `ROADMAP-TACHES.md` là où ils diffèrent ; les identifiants de tâches restent ceux de la roadmap.
Source des décisions : `architecture/DECISIONS-A-TRANCHER.md`.

## 1. Effet des décisions sur la conception

| Décision | Conséquence technique |
|---|---|
| D-01 commission sur le tuteur seul | Pas de « frais de service » côté client : prix client = tarif × durée + déplacement. Commission retenue au calcul du net tuteur. **La date de D-01 est vide : à confirmer.** |
| D-14 taxes en attente | Aucun taux codé. Le calcul prévoit une ligne « taxe » à 0 et un point d'extension ; activation seulement après avis du comptable |
| Config. dans Office | Table de paramètres **versionnée** (valeur, date d'effet, auteur) lue au moment de l'acceptation et **figée** dans la réservation. Écran Office dès la vague 1 |
| D-02 déplacement | Le tuteur propose, l'Office valide avant publication. Taxi : minimum 10 000 Ar, **proposé par le tuteur, accepté par le demandeur avant paiement** : nouvel état/étape « montant à accepter » dans la réservation. En ligne = 0 (à confirmer) |
| D-03 durée libre | Durée choisie par le demandeur, mais plafonnée : expire au plus tard avant le début du cours (marge à définir) |
| D-04 15 min | Au conflit, le second paiement passe en `CONFLICT` avec minuteur de 15 min : proposition d'autres créneaux ; sans acceptation, remboursement. Échec de remboursement → file de reprise + tâche Odoo |
| D-05 | Webhook tardif : relecture serveur, re-confirmation si le créneau est libre sinon remboursement, tout historisé |
| D-06 partielle | Remboursement intégral ≥ 24 h. **Règle < 24 h non décidée** : paramètre configurable ; tant qu'il manque, annulation < 24 h = décision manuelle d'un conseiller |
| D-07 reversement manuel | `Settlement` créé à la clôture mais statut `A_VALIDER` ; passe `VALIDE` par un conseiller autorisé (rôle, trace). Aucun virement automatique |
| D-08 | Confirmation par le demandeur ; sans réponse 24 h après la déclaration du tuteur, clôture selon le tuteur sauf contestation |
| D-16 Mobile Money direct | Le service de paiement existant (`eduloc-pay-subscriptions`) reste l'interface ; adaptateurs par opérateur derrière. Carte non décidée : ne pas l'implémenter |
| D-17 | Bénéficiaire mineur : prénom, âge, niveau, infos pédagogiques ; pas de nom de famille ni photo imposés. Validation juridique avant mise en production |

## 2. Décisions encore bloquantes (à lever avant la tâche indiquée)

| Avant | Question |
|---|---|
| T-FIN-01 | D-01 : confirmer la date ; assiette de la commission (tarif seul ou avec déplacement) ; taux |
| T-FIN-01 | D-02 : qui perçoit le déplacement ; cours en ligne = 0 |
| T-BKG-02 | D-03 : durées minimale/maximale et marge avant le cours |
| T-BKG-03 | D-04 : point de départ des 15 min ; cas du paiement encore en cours |
| T-BKG-03 | D-06 : règle < 24 h, annulation tuteur, absence, frais remboursables |
| T-FIN-02 | D-07 : critères, délai cible, rôle autorisé, fréquence de virement |
| T-PAY-01 | D-16 : opérateurs retenus et faisabilité (accès marchand, API, remboursement) |
| T-SES-03 | D-09 (P1) ; **T-SES-04** D-10 ; **T-SES-05** D-11 |
| Toute collecte de production | D-17 validation juridique ; D-14 avis comptable |

## 3. Ordre de développement

Règle : une étape démarre quand ses dépendances sont fusionnées et vertes. `‖` = en parallèle (périmètres disjoints). Pas de PR de schéma simultanée.

### Étape 1 : socle (peut démarrer maintenant, aucune décision ouverte ne bloque)
1. T-OPS-01 : pousser et activer les trois pipelines (secrets, environnements).
2. T-QA-00 : jeu de données et fixtures. ‖ En parallèle : rédiger les contrats (événements, ticket, webhook) dans `docs/`.
3. T-AUD-01 : journal d'audit. ‖ T-OBX-01 : outbox d'événements.

### Étape 2 : paramètres et machine d'états
4. **T-PRM-01 (nouveau)** : paramètres commerciaux versionnés + écran Office minimal (D-01, D-02, config Office). Sans taux fiscal.
5. T-BKG-01 : machine d'états (ajouter `EXPIRED`, `AWAITING_PAYMENT`, `CONFLICT`, `DISPUTED`, étape d'acceptation du montant taxi).
6. T-FIN-01 : fonction de calcul pure (tarif × durée + déplacement ; commission tuteur ; taxe = point d'extension à 0). *Dès que D-01/D-02 sont précisés.*

### Étape 3 : réservation et paiement
7. T-BKG-02 : expiration des demandes (durée libre bornée).
8. **T-BKG-04 (nouveau)** : proposition de déplacement par le tuteur, validation Office, acceptation du taxi par le demandeur avant paiement.
9. T-BKG-03 : attribution atomique du créneau au premier paiement validé ; conflit avec minuteur de 15 min (D-04) ; reprise après T2 (D-05). *Test de concurrence en premier.*
10. **T-FIN-03 (nouveau)** : politique d'annulation/remboursement (intégral ≥ 24 h, reste paramétrable) et file de reprise des remboursements.
11. T-PAY-01 : durcissement du webhook, idempotence, remboursement tracé ; adaptateur du premier opérateur Mobile Money *dès que D-16 est confirmé*.

### Étape 4 : séance et reversement
12. T-SES-01 → T-SES-02 (clôture D-08) → T-SES-03 ‖ T-SES-04 ‖ T-SES-05 (selon D-09, D-10, D-11).
13. T-FIN-02 : `Settlement` en `A_VALIDER`, validation manuelle par un conseiller autorisé, traçabilité (D-07). Le virement reste hors système au début.

### Étape 5 : canaux et opérations (peut commencer en parallèle de l'étape 4 pour Odoo)
14. T-ODO-01 → T-ODO-02 → T-ODO-03.
15. T-TEL-01 → T-TEL-02 (après D-12).
16. T-OFF-01 (validation tuteurs, offres, déplacement) ‖ T-OFF-02 (supervision, litiges, reversements à valider) ‖ T-APP-01 (écrans de bout en bout).

### Étape 6 : pilotage
17. T-ANA-01 → T-ANA-02 → T-MAT-01.

### Schéma de l'ordre critique
```
OPS/QA → AUD ‖ OBX → PRM → BKG-01 → FIN-01 → BKG-02 → BKG-04 → BKG-03 → FIN-03 → PAY-01
                                                                   ↓
                                             SES-01 → SES-02 → (SES-03 ‖ 04 ‖ 05) → FIN-02
ODO-01 → ODO-02 → ODO-03     TEL-01 → TEL-02     OFF-01 → OFF-02     APP-01
```

## 4. Lien avec la roadmap de test

| Étape | Palier de test atteignable |
|---|---|
| 1-2 | P0, P1 (contrats) |
| 3 | P2 (S-01 à S-04), P3 (X-01 à X-06, X-11, X-13) |
| 4 | P2 (S-05), P3 (X-07 à X-10, X-12), P6 (réconciliation, avec reversement manuel) |
| 5 | P4, P5 |
| Avant pilote | P7, puis P8 |

Le pilote P8 est conditionné à : D-14 (avis comptable), D-17 (validation juridique), D-16 (opérateur contractualisé), D-06 complété.

## 5. Ce qui peut commencer aujourd'hui

T-OPS-01, T-QA-00, T-AUD-01, T-OBX-01, T-PRM-01, T-BKG-01 (les deux derniers sans valeurs fiscales ni règle < 24 h).
