# Roadmap des tâches (ordre d'exécution)

Lecture : une tâche ne démarre que lorsque **toutes** ses dépendances sont fusionnées et vertes. Les tâches d'une même vague, sans dépendance
entre elles, peuvent être menées en parallèle par des rôles différents (périmètres disjoints : voir `agents/AGENTS.md`).
Les identifiants de tests (`TP-…`) renvoient à `tests/PLAN-DE-TESTS.md`.

## Vague 0 : décisions et socle (aucun code métier)

| ID | Tâche | Rôle | Dépend de | Fin quand |
|---|---|---|---|---|
| T-DEC-01 | Trancher les décisions ouvertes bloquantes (archi §4) : durées T1/T2, second paiement, clôture mineur, délai de grâce | A1 | — | Chaque décision écrite, datée, dans `docs/` |
| T-OPS-01 | Pipelines CI/CD et sécurité en place | A8 | — | 3 workflows verts sur `main` |
| T-QA-00 | Base de tests : jeu de données minimal (tuteur, offre, créneau, demandeur, bénéficiaire), utilitaires de fixtures | A7 | T-OPS-01 | `npm run test:int` vert en CI |

## Vague 1 : fondations de données

| ID | Tâche | Rôle | Dépend de | Migration | Fin quand |
|---|---|---|---|---|---|
| T-FIN-01 | Paramètres commerciaux versionnés (`PricingParameter` : frais déplacement, frais service, commissions, taxes) et fonction de calcul pure | A2 | T-DEC-01 | M1 | TP-FIN-01..05 verts |
| T-OBX-01 | Outbox d'intégration : table, publication fiable, signature HMAC, rejeu | A3 | T-QA-00 | M2 | TP-OBX-01..04 verts |
| T-AUD-01 | Journal d'audit des actions sensibles (acteur, rôle, cible, avant/après) | A2 | T-QA-00 | M3 | TP-AUD-01..02 verts |

## Vague 2 : cycle de réservation

| ID | Tâche | Rôle | Dépend de | Migration | Fin quand |
|---|---|---|---|---|---|
| T-BKG-01 | Machine d'états de réservation centralisée (`EXPIRED`, `AWAITING_PAYMENT`, `DISPUTED`), transitions refusées si illégales | A2 | T-AUD-01 | M4 | TP-BKG-01..04 verts |
| T-BKG-02 | Expiration des demandes (T1) : tâche planifiée idempotente, renvoi lié | A2 | T-BKG-01, T-OBX-01 | — | TP-BKG-05..07 verts |
| T-BKG-03 | Attribution atomique du créneau au premier paiement validé ; délai T2 ; second paiement | A2 | T-BKG-01, T-FIN-01 | M5 | TP-BKG-08..12 verts, test de concurrence stable sur 50 exécutions |
| T-PAY-01 | Durcissement du webhook : idempotence, tardifs, remboursement tracé | A2 | T-BKG-03 | M6 | TP-PAY-01..07 verts |

## Vague 3 : séance, clôture, finance

| ID | Tâche | Rôle | Dépend de | Migration | Fin quand |
|---|---|---|---|---|---|
| T-SES-01 | Début de séance, chronomètre serveur, événements de présence | A2 | T-BKG-03 | M7 | TP-SES-01..03 |
| T-SES-02 | Double validation de fin (tuteur puis bénéficiaire ou responsable) | A2 | T-SES-01 | — | TP-SES-04..06 |
| T-SES-03 | Déconnexion et clôture automatique après délai de grâce | A2 | T-SES-02 | — | TP-SES-07..09 |
| T-SES-04 | Dépassement de durée enregistré, sans supplément automatique | A2 | T-SES-02 | — | TP-SES-10 |
| T-SES-05 | Désaccord : état `DISPUTED`, reversement bloqué, décision enregistrée | A2 | T-SES-02, T-AUD-01 | M8 | TP-SES-11..13 |
| T-FIN-02 | `Settlement` : calcul figé à la clôture, reversement tuteur distinct | A2 | T-SES-02, T-FIN-01 | M9 | TP-FIN-06..10 |

## Vague 4 : opérations humaines et canaux

| ID | Tâche | Rôle | Dépend de | Fin quand |
|---|---|---|---|---|
| T-TEL-01 | Rôle `AGENT` + contact invité + création de réservation pour un tiers via l'API | A3 | T-BKG-03, T-AUD-01 | TP-TEL-01..06 |
| T-TEL-02 | Lien de paiement envoyé au demandeur sans compte | A3 | T-TEL-01, T-PAY-01 | TP-TEL-07..08 |
| T-ODO-01 | Installation d'Odoo, modèle de données minimal, secrets (voir `odoo integration.md`) | A4 | T-DEC-01 | Odoo démarre, accès restreint |
| T-ODO-02 | Connecteur : consommation des événements (W6), idempotence, tâches créées | A4 + A3 | T-ODO-01, T-OBX-01 | TP-ODO-01..06 |
| T-ODO-03 | Réclamations : dossiers, états, lien avec `DISPUTED` | A4 | T-ODO-02, T-SES-05 | TP-ODO-07..08 |
| T-OFF-01 | Office : validation tuteurs, offres, tarifs ; paramètres commerciaux | A6 | T-FIN-01 | TP-OFF-01..03 |
| T-OFF-02 | Office : supervision des réservations, litiges, transactions | A6 | T-SES-05, T-PAY-01 | TP-OFF-04..06 |
| T-APP-01 | Application : états de réservation, expiration, paiement, clôture | A5 | T-BKG-03, T-SES-02 | TP-APP-01..05 |

## Vague 5 : qualité et pilotage

| ID | Tâche | Rôle | Dépend de | Fin quand |
|---|---|---|---|---|
| T-ANA-01 | Collecte d'événements analytiques (durées, expirations, délais de réponse) | A3 | T-OBX-01 | TP-ANA-01 |
| T-ANA-02 | Indicateurs et alertes qualité | A3 + A6 | T-ANA-01 | Tableau de bord validé |
| T-MAT-01 | Amélioration du classement (qualité, fiabilité) sans toucher aux règles d'éligibilité | A2 | T-ANA-01 | `matching:eval` non régressif |

## Parallélisme possible

```
Vague 0 : T-DEC-01 ‖ T-OPS-01 → T-QA-00
Vague 1 : T-FIN-01 ‖ T-OBX-01 ‖ T-AUD-01
Vague 2 : T-BKG-01 → T-BKG-02 ‖ T-BKG-03 → T-PAY-01
Vague 3 : T-SES-01 → T-SES-02 → (T-SES-03 ‖ T-SES-04 ‖ T-SES-05) → T-FIN-02
Vague 4 : (T-TEL-01 → T-TEL-02) ‖ (T-ODO-01 → T-ODO-02 → T-ODO-03) ‖ T-OFF-01 → T-OFF-02 ‖ T-APP-01
```

Une seule PR de schéma (M1..M9) ouverte à la fois : les migrations s'enchaînent dans l'ordre des numéros ci-dessus.

## Définition de « terminé » (toutes tâches)

- [ ] Critères de fin de la ligne atteints, tests listés verts en CI locale et distante.
- [ ] Aucune alerte nouvelle de `backend-security.yml`.
- [ ] Contrats et documentation mis à jour (`docs/`).
- [ ] Drapeau de fonctionnalité en place si la fonctionnalité est incomplète.
- [ ] Note de passation dans la PR.
