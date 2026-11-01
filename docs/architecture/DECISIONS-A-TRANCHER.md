# Décisions à trancher avant d'implémenter

Chaque décision a : l'enjeu, des options, une **recommandation** (à contester), et ce qu'elle bloque. À remplir dans la colonne « Décision » avec date et décideur.
Priorité : **P0** = bloque le code dès la vague 1-2 ; **P1** = bloque une vague ultérieure ; **P2** = peut attendre le pilote.

## Synthèse

| ID | Sujet | Priorité | Bloque | Décision | Date |
|---|---|---|---|---|---|
| D-01 | Modèle de prix et qui paie la commission | P0 | T-FIN-01 | | |
| D-02 | Frais de déplacement | P0 | T-FIN-01 | | |
| D-03 | Durées de validité d'une demande (T1) | P0 | T-BKG-02 | | |
| D-04 | Second paiement sur un créneau déjà attribué | P0 | T-BKG-03 | | |
| D-05 | Paiement tardif après expiration (T2) | P0 | T-BKG-03, T-PAY-01 | | |
| D-06 | Annulation et remboursement | P0 | T-BKG-03 | | |
| D-07 | Moment du reversement au tuteur | P0 | T-FIN-02 | | |
| D-08 | Clôture si le bénéficiaire ne répond pas / mineur | P0 | T-SES-02 | | |
| D-09 | Délai de grâce après déconnexion | P1 | T-SES-03 | | |
| D-10 | Dépassement de durée | P1 | T-SES-04 | | |
| D-11 | Procédure de litige | P1 | T-SES-05, T-ODO-03 | | |
| D-12 | Réservation téléphonique : identification et données minimales | P1 | T-TEL-01 | | |
| D-13 | Suspension d'un tuteur avec réservations à venir | P1 | T-OFF-02 | | |
| D-14 | Taxes (client, tuteur) et statut fiscal | P0 | T-FIN-01 | | |
| D-15 | Odoo : version, hébergement, modules, périmètre | P1 | T-ODO-01 | | |
| D-16 | Prestataire de paiement et moyens acceptés | P0 | T-PAY-01, P6 | | |
| D-17 | Données personnelles et mineurs | P0 | toute collecte | | |
| D-18 | Environnements, hébergement, sauvegardes | P1 | CD production | | |
| D-19 | Indicateurs et alertes analytiques | P2 | T-ANA-02 | | |
| D-20 | Vidéo : langue, ton, voix, vouvoiement | P2 | storyboard | | |

## Détail

### D-01 Modèle de prix et commission (P0)
Enjeu : éviter de prélever deux fois et être lisible pour le client.
Options : (a) commission uniquement sur le tuteur ; (b) frais de service uniquement sur le client ; (c) les deux, avec taux distincts et affichés.
Recommandation : (c) seulement si les deux sont affichés séparément ; sinon (a) pour le lancement (plus simple à expliquer).
À fournir : taux, assiette (tarif seul ou tarif + déplacement), arrondi (MGA, à l'unité).

### D-02 Frais de déplacement (P0)
Hypothèse actuelle : forfait 1 500 Ar, plafond 2 500 Ar, option taxi.
Options : forfait unique ; barème par distance (tranches) ; réel avec justificatif.
Recommandation : barème par tranches de distance avec plafond ; taxi hors v1 (le choix et la confirmation du montant ajoutent un conflit possible).
À fournir : tranches, qui perçoit le montant (tuteur ou EduLoc), traitement d'un changement de lieu, cours en ligne = 0.

### D-03 Validité d'une demande (T1) (P0)
Options proposées : 15 min, 30 min, 1 h, personnalisée.
Recommandation : 30 min par défaut, choix 15 min / 30 min / 1 h / 2 h ; jamais au-delà du début du cours moins une marge.
À fournir : minimum, maximum, règle si le créneau est proche (< 2 h).

### D-04 Deux paiements sur le même créneau (P0)
Options : (a) remboursement automatique du second ; (b) proposer d'abord un autre créneau, remboursement après 15 min ; (c) mise en attente.
Recommandation : (a) remboursement automatique + proposition d'alternatives + tâche Odoo ; le plus simple à prouver.

### D-05 Paiement reçu après expiration de T2 (P0)
Options : refus + remboursement ; reprise du créneau s'il est encore libre, sinon remboursement.
Recommandation : reprise si libre, sinon remboursement ; toujours une trace et un message au client.

### D-06 Annulation et remboursement (P0)
À définir : fenêtres (ex. > 24 h : 100 % ; 24 h-2 h : x % ; < 2 h : 0 %), annulation par le tuteur (remboursement intégral + pénalité de fiabilité ?), absence du demandeur, frais de service remboursables ou non.
Recommandation : démarrer simple, 3 paliers, annulation tuteur toujours remboursée intégralement.

### D-07 Moment du reversement (P0)
Options : à la clôture ; clôture + délai de contestation (ex. 24 h) ; paiement groupé hebdomadaire.
Recommandation : clôture + 24 h sans contestation, versement groupé hebdomadaire pour le pilote.

### D-08 Clôture sans réponse / bénéficiaire mineur (P0)
Questions : qui confirme pour un mineur (le demandeur ?), que se passe-t-il sans réponse sous X heures ?
Recommandation : le demandeur (responsable) confirme ; sans réponse sous 24 h, clôture automatique en faveur de la déclaration du tuteur, sauf contestation.

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

### D-14 Taxes et statut fiscal (P0)
À valider avec un comptable : taxe sur la vente de service, statut du tuteur (indépendant ?), obligations de déclaration d'EduLoc, facture ou reçu, mentions légales.
Aucun taux ne doit être codé avant cette validation.

### D-15 Odoo (P1)
À définir : version (19 Community prévue), hébergement, modules, équipe initiale (2 à 5 agents), niveau d'intégration (événements sortants + API entrante), sauvegardes, qui administre.
Recommandation : périmètre v1 = contacts, demandes, tâches, réclamations ; ni comptabilité ni facturation dans Odoo au lancement.

### D-16 Prestataire de paiement (P0)
À définir : prestataire(s) Mobile Money et carte, frais, délais de règlement, remboursement possible par API, environnement de test, preuve de conformité.
Sans réponse, le palier P6 ne peut pas être préparé.

### D-17 Données personnelles et mineurs (P0)
À définir : base légale et consentement, qui consent pour un mineur, durées de conservation, accès des conseillers aux données d'enfants, droit de suppression, hébergement des données, politique de confidentialité.
Recommandation : minimisation (prénom et niveau suffisent pour un bénéficiaire mineur), accès journalisé.

### D-18 Hébergement et exploitation (P1)
À définir : fournisseur, taille, sauvegardes (fréquence, rétention, test de restauration), surveillance, qui est d'astreinte pendant le pilote, coût mensuel acceptable.

### D-19 Indicateurs (P2)
Retenir 5 indicateurs maximum au départ : taux de demandes acceptées, taux d'expiration, délai moyen de réponse du tuteur, taux de séances clôturées sans litige, satisfaction.

### D-20 Vidéo (P2)
Langue(s), vouvoiement ou tutoiement, voix humaine ou synthétique, budget, ressources (studio, motion designer), date de publication.

## Ordre pour décider

1. **Cette semaine** : D-16, D-14, D-01, D-02, D-17 (dépendent de tiers : prestataire, comptable, juridique).
2. **Avant la vague 2** : D-03, D-04, D-05, D-06, D-07, D-08.
3. **Avant la vague 3-4** : D-09 à D-13, D-15, D-18.
4. **Avant le pilote** : D-19, D-20, et confirmation des seuils de la roadmap de test (P7, P8).

Une décision prise est copiée dans `ARCHITECTURE-GLOBALE.md` §4 (supprimée de la liste ouverte) et dans le test correspondant.
