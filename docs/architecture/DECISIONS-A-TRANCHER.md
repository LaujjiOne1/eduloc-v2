# Décisions à trancher avant d'implémenter

Chaque décision a : l'enjeu, des options, une **recommandation** (à contester), et ce qu'elle bloque. À remplir dans la colonne « Décision » avec date et décideur.
Priorité : **P0** = bloque le code dès la vague 1-2 ; **P1** = bloque une vague ultérieure ; **P2** = peut attendre le pilote.

## Synthèse

| ID | Sujet | Priorité | Bloque | Décision | Date |
|---|---|---|---|---|---|
| D-01 | Modèle de prix et qui paie la commission | P0 | T-FIN-01 | Commission uniquement prélevée sur le tuteur | |
| D-02 | Frais de déplacement | P0 | T-FIN-01 | **Tuteur propose le montant, EduLoc valide. Taxi : minimum 10 000 Ar ; tuteur propose, demandeur accepte.** | 2026-11-01 |
| D-03 | Durées de validité d'une demande (T1) | P0 | T-BKG-02 | **Durée libre choisie par le demandeur** | 2026-11-01 |
| D-04 | Second paiement sur un créneau déjà attribué | P0 | T-BKG-03 | **Attente de 15 min, puis remboursement si aucune autre plage n'est acceptée** | 2026-11-01 |
| D-05 | Paiement tardif après expiration (T2) | P0 | T-BKG-03, T-PAY-01 | **Réaccepter si le créneau est encore libre, sinon rembourser** | 2026-11-01 |
| D-06 | Annulation et remboursement | P0 | T-BKG-03 | **Remboursement intégral jusqu'à 24 h avant le cours ; règle après ce seuil à préciser** | 2026-11-01 |
| D-07 | Moment du reversement au tuteur | P0 | T-FIN-02 | **Après validation manuelle du service client** | 2026-11-01 |
| D-08 | Clôture si le bénéficiaire ne répond pas / mineur | P0 | T-SES-02 | **Le demandeur responsable confirme ; sans réponse sous 24 h, clôture selon la déclaration du tuteur sauf contestation** | 2026-11-01 |
| D-09 | Délai de grâce après déconnexion | P1 | T-SES-03 | | |
| D-10 | Dépassement de durée | P1 | T-SES-04 | | |
| D-11 | Procédure de litige | P1 | T-SES-05, T-ODO-03 | | |
| D-12 | Réservation téléphonique : identification et données minimales | P1 | T-TEL-01 | | |
| D-13 | Suspension d'un tuteur avec réservations à venir | P1 | T-OFF-02 | | |
| D-14 | Taxes (client, tuteur) et statut fiscal | P0 | T-FIN-01 | **En attente : validation du modèle par un comptable** | 2026-11-01 |
| D-15 | Odoo : version, hébergement, modules, périmètre | P1 | T-ODO-01 | | |
| D-16 | Prestataire de paiement et moyens acceptés | P0 | T-PAY-01, P6 | **Intégrer directement les opérateurs Mobile Money si possible ; moyens exacts à confirmer selon le prestataire** | 2026-11-01 |
| D-17 | Données personnelles et mineurs | P0 | toute collecte | **Prénom, âge, niveau et informations pédagogiques nécessaires ; validation juridique encore requise** | 2026-11-01 |
| D-18 | Environnements, hébergement, sauvegardes | P1 | CD production | | |
| D-19 | Indicateurs et alertes analytiques | P2 | T-ANA-02 | | |
| D-20 | Vidéo : langue, ton, voix, vouvoiement | P2 | storyboard | **Première version en français ; ton, voix et vouvoiement à définir** | 2026-11-01 |

## Décisions transversales déjà prises

- **Configuration des frais :** les frais et montants commerciaux doivent être modifiables depuis EduLoc Office (back-office), sans modification du code. Les changements doivent être historisés et ne pas recalculer rétroactivement les réservations déjà confirmées.
- **Taxi :** montant minimum de **10 000 Ar**. Le tuteur propose le montant et le demandeur doit l'accepter avant le paiement.
- **Vidéo de présentation :** première version en **français**. Les autres choix de production restent ouverts.

Ces règles sont considérées comme décidées au 2026-11-01, sous réserve des précisions explicitement indiquées ci-dessous.

## Détail

### D-01 Modèle de prix et commission (P0)
Enjeu : éviter de prélever deux fois et être lisible pour le client.
Options : (a) commission uniquement sur le tuteur ; (b) frais de service uniquement sur le client ; (c) les deux, avec taux distincts et affichés.
Recommandation : (c) seulement si les deux sont affichés séparément ; sinon (a) pour le lancement (plus simple à expliquer).
À fournir : taux, assiette (tarif seul ou tarif + déplacement), arrondi (MGA, à l'unité). Les paramètres et frais commerciaux doivent être configurables dans EduLoc Office, sans changement de code.

### D-02 Frais de déplacement (P0) — décision prise, précisions ouvertes
**Décision :** le tuteur propose le montant des frais de déplacement et EduLoc le valide avant publication ou facturation.

**Taxi :** minimum de **10 000 Ar**. Le tuteur propose le montant et le demandeur l'accepte avant le paiement.

**Configuration :** les montants et paramètres de frais sont modifiables dans EduLoc Office, sans changement de code.

À préciser : qui perçoit les frais de déplacement, comment EduLoc valide les propositions, traitement d'un changement de lieu, et confirmation que les cours en ligne ont toujours 0 Ar de frais de déplacement. Les anciennes hypothèses de 1 500 Ar et 2 500 Ar ne constituent plus des montants validés.

### D-03 Validité d'une demande (T1) (P0) — décision prise, bornes ouvertes
**Décision :** la durée de validité est librement choisie par le demandeur.

À préciser avant implémentation : durée minimale et maximale autorisées, marge obligatoire avant le début du cours, et comportement si le créneau est proche. Le choix libre ne doit pas permettre à une demande de rester active au-delà du début du cours.

### D-04 Deux paiements sur le même créneau (P0) — décision prise, scénario à préciser
**Décision :** lorsqu'un conflit de paiement survient, attendre 15 minutes afin de proposer et faire accepter un autre créneau. Si aucune autre plage n'est acceptée dans ce délai, rembourser le paiement concerné.

À préciser : ce délai s'applique-t-il uniquement au second paiement effectivement encaissé ou à une transaction encore en cours ? Définir aussi le point de départ des 15 minutes et la procédure si le remboursement automatique échoue. Le verrouillage atomique du créneau reste obligatoire.

### D-05 Paiement reçu après expiration de T2 (P0) — décision prise
**Décision :** réaccepter le paiement si le créneau est encore libre au moment de la vérification serveur ; sinon rembourser. Chaque cas doit être historisé et communiqué au client.

### D-06 Annulation et remboursement (P0) — décision partielle
**Décision :** remboursement intégral lorsque l'annulation intervient au moins 24 heures avant le cours.

À préciser : remboursement applicable à moins de 24 heures, annulation par le tuteur, absence du demandeur, remboursement des frais de service et frais de déplacement. La règle sélectionnée ne permet pas encore de déduire la politique après le seuil de 24 heures.

### D-07 Moment du reversement (P0) — décision prise, procédure à préciser
**Décision :** le reversement au tuteur intervient après validation manuelle du service client.

À préciser : les critères de validation, le délai cible, le rôle du conseiller autorisé, la traçabilité de la décision et la fréquence des virements.

### D-08 Clôture sans réponse / bénéficiaire mineur (P0) — décision prise
**Décision :** le demandeur responsable confirme la fin de la séance. Sans réponse sous 24 heures, la séance est clôturée selon la déclaration du tuteur, sauf contestation.

À préciser : canal et délai de notification, moment exact où démarrent les 24 heures, et traitement des bénéficiaires majeurs qui utilisent leur propre compte.

### D-09 Délai de grâce après déconnexion (P1)
Recommandation : 10 minutes de grâce, puis rappel au tuteur de déclarer la fin ; jamais de clôture sur déconnexion seule.

### D-10 Dépassement de durée (P1)
Options : jamais de supplément ; supplément si accord préalable des deux parties dans l'application ; facturation au prorata.
Recommandation : pas de supplément en v1 ; le dépassement est enregistré pour l'analyse.

### D-11 Procédure de litige (P1)
À définir : délai pour contester, preuves acceptées (présence, durée, messages), qui décide, délai de décision, voies de recours, issues (libérer, ajuster, rembourser, suspendre).
Recommandation : décision par un conseiller senior sous 72 h, issues limitées à ces quatre choix, tout journalisé.

### D-12 Réservation téléphonique (P1)
À définir : données minimales (nom, téléphone, bénéficiaire, niveau, matière, lieu), vérification d'identité sans compte (rappel au numéro, code reçu par SMS), droit de créer un compte après coup, enregistrement des appels (consentement).
Recommandation : vérification par code SMS avant paiement ; pas d'enregistrement audio en v1.

### D-13 Tuteur suspendu avec réservations à venir (P1)
Options : maintenir celles déjà payées ; annuler et rembourser ; réaffecter avec accord.
Recommandation : réaffectation proposée, sinon remboursement intégral, décision par un conseiller.

### D-14 Taxes et statut fiscal (P0) — en attente d'un avis comptable
**Décision :** ne fixer aucun taux ni règle fiscale maintenant. Faire valider le modèle par un comptable.

À vérifier : taxe sur la vente de service, statut du tuteur, obligations déclaratives d'EduLoc, factures ou reçus et mentions légales. Aucun taux ne doit être codé avant validation.

### D-15 Odoo (P1)
À définir : version (19 Community prévue), hébergement, modules, équipe initiale (2 à 5 agents), niveau d'intégration (événements sortants + API entrante), sauvegardes, qui administre.
Recommandation : périmètre v1 = contacts, demandes, tâches, réclamations ; ni comptabilité ni facturation dans Odoo au lancement.

### D-16 Prestataire de paiement (P0) — orientation prise, faisabilité à vérifier
**Décision :** privilégier l'intégration directe des opérateurs Mobile Money si cela est techniquement et contractuellement possible.

Les moyens de paiement exacts restent **à confirmer selon le prestataire**. Vérifier pour chaque opérateur : accès marchand, API, webhooks, remboursements, frais, délais de règlement, environnement de test et conditions de conformité. La prise en charge de Visa et Mastercard n'est pas décidée.

### D-17 Données personnelles et mineurs (P0) — périmètre de collecte choisi, conformité ouverte
**Décision :** collecter le prénom, l'âge, le niveau et les informations pédagogiques nécessaires.

À préciser et valider : quelles informations pédagogiques sont strictement nécessaires, consentement du responsable pour un mineur, base légale, durées de conservation, accès des conseillers, droits des personnes, hébergement et politique de confidentialité. La décision de collecte ne vaut pas validation juridique.

### D-18 Hébergement et exploitation (P1)
À définir : fournisseur, taille, sauvegardes (fréquence, rétention, test de restauration), surveillance, qui est d'astreinte pendant le pilote, coût mensuel acceptable.

### D-19 Indicateurs (P2)
Retenir 5 indicateurs maximum au départ : taux de demandes acceptées, taux d'expiration, délai moyen de réponse du tuteur, taux de séances clôturées sans litige, satisfaction.

### D-20 Vidéo (P2)
**Décision :** première version en français.
À définir : vouvoiement ou tutoiement, voix humaine ou synthétique, budget, ressources (studio, motion designer), date de publication et éventuelles versions dans d'autres langues.

## Ordre pour décider

1. **Cette semaine** : D-16, D-14, D-01, D-02, D-17 (dépendent de tiers : prestataire, comptable, juridique).
2. **Avant la vague 2** : D-03, D-04, D-05, D-06, D-07, D-08.
3. **Avant la vague 3-4** : D-09 à D-13, D-15, D-18.
4. **Avant le pilote** : D-19, D-20, et confirmation des seuils de la roadmap de test (P7, P8).

Une décision prise est copiée dans `ARCHITECTURE-GLOBALE.md` §4 (supprimée de la liste ouverte) et dans le test correspondant.
