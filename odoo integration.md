Avec ces choix, je recommande une architecture assez précise : Odoo 19 Community auto-hébergé sur un VPS, avec PostgreSQL, et un petit module d'intégration EduLoc. La version exacte devra être confirmée après vérification de la compatibilité des modules et des contraintes de licence.

Pour l'équipe de 2 à 5 agents, le périmètre initial sera volontairement limité à la relation client : demandes entrantes, contacts, qualification, attribution, relances et suivi des dossiers.

Je retiens également deux éléments déjà présents dans ton projet :

- Le site vitrine possède un assistant guidé et enregistre les demandes dans `support_requests`, avec une référence et un statut initial `nouvelle`.
- Le backend EduLoc doit conserver la responsabilité des tuteurs, bénéficiaires, disponibilités et réservations.&#x20;

  Branche · Progrès du projet MVP.txt

  Branche · Progrès du projet MVP.txt



Voici le cahier de configuration et d'intégration. Il est conçu pour devenir ton document de référence avant de commencer l'installation.

# Cahier de configuration et d'intégration — Odoo / EduLoc

**Version :** 1.0\
**Date :** 30 octobre 2026\
**Périmètre :** CRM et relation client\
**Déploiement :** Auto-hébergement (self-hosted)\
**Équipe initiale :** 2 à 5 agents\
**Système concerné :** Site vitrine EduLoc, Odoo et backend EduLoc

---

# 1. Objectif du projet

Mettre en place Odoo comme système central de gestion de la relation client d'EduLoc.

Odoo doit permettre à l'équipe de :

- recevoir les demandes provenant du site vitrine ;
- centraliser les coordonnées des demandeurs ;
- qualifier les besoins éducatifs ;
- attribuer les dossiers aux agents ;
- organiser les appels et les relances ;
- suivre l'évolution de chaque demande ;
- conserver l'historique des interactions ;
- identifier les demandes converties en réservations EduLoc.

Le déploiement initial ne doit pas remplacer le backend de la plateforme EduLoc.

## 1.1 Périmètre fonctionnel

| Fonctionnalité                         | Périmètre           |
| -------------------------------------- | ------------------- |
| Réception des demandes du site         | Inclus              |
| Gestion des contacts                   | Inclus              |
| Qualification des prospects            | Inclus              |
| Attribution aux agents                 | Inclus              |
| Activités et relances                  | Inclus              |
| Historique des interactions            | Inclus              |
| Suivi commercial                       | Inclus              |
| Synchronisation des réservations       | Hors première phase |
| Gestion des disponibilités des tuteurs | Hors périmètre      |
| Gestion des bénéficiaires              | Hors périmètre      |
| Gestion des paiements                  | Hors périmètre      |
| Comptabilité et RH                     | Hors périmètre      |

# 2. Architecture technique

## 2.1 Architecture cible

```
                  SITE VITRINE EDULOC
                         |
                         |
                  Formulaire guidé
                         |
                         v
                support_requests
                         |
                         v
              BACKEND D'INTÉGRATION
                         |
                  API sécurisée
                         |
                         v
                  ODOO 19
                    |
          +---------+----------+
          |                    |
          v                    v
       CRM                 CONTACTS
          |                    |
          v                    |
    Pipeline commercial        |
          |                    |
          +---------+----------+
                    |
                    v
              AGENTS EDULOC
```

Le backend EduLoc reste indépendant :

```
             APPLICATION EDULOC
                     |
                     v
               BACKEND EDULOC
                     |
          +----------+----------+
          |          |          |
          v          v          v
        Tuteurs  Bénéficiaires Réservations
```

Une connexion entre Odoo et le backend EduLoc pourra être ajoutée ultérieurement.

## 2.2 Responsabilités des systèmes

| Système               | Responsabilité                                      |
| --------------------- | --------------------------------------------------- |
| Site vitrine          | Collecter les demandes                              |
| Backend d'intégration | Transmettre les demandes et gérer les erreurs       |
| Odoo                  | Gérer les contacts, dossiers et interactions        |
| Backend EduLoc        | Gérer les opérations éducatives et les réservations |

## 2.3 Principe de propriété des données

Une information doit avoir un système de référence unique.

- La soumission initiale est conservée dans le backend du site.
- Le traitement de la demande est géré dans Odoo.
- Les données pédagogiques et les réservations sont gérées dans EduLoc.

Il ne faut pas synchroniser toutes les données dans les deux sens dès le départ.

# 3. Infrastructure Odoo

## 3.1 Choix technologique

- Édition envisagée : Odoo Community.
- Version cible : Odoo 19.0.
- Système : Linux.
- Conteneurisation : Docker et Docker Compose.
- Base de données : PostgreSQL.
- Reverse proxy : Nginx.
- Certificat HTTPS : Let's Encrypt ou équivalent.
- Hébergement : VPS disposant d'une adresse IP publique et d'un nom de domaine.

L'édition Community est privilégiée pour maîtriser les coûts et conserver la possibilité de développer des modules spécifiques.

Le choix définitif de l'édition doit être validé avec les besoins d'API, les fonctionnalités CRM et les conditions de licence.

## 3.2 Architecture Docker souhaitée

```
VPS
 |
 +-- Nginx
 |     |
 |     +-- HTTPS
 |     +-- Reverse Proxy
 |
 +-- Odoo 19
 |     |
 |     +-- Modules standards
 |     +-- Modules personnalisés EduLoc
 |
 +-- PostgreSQL
       |
       +-- Base Odoo
```

Les données persistantes doivent être conservées dans des volumes Docker :

- base PostgreSQL ;
- filestore Odoo ;
- configuration ;
- modules personnalisés.

Les mots de passe et clés doivent être conservés dans des variables d'environnement ou un gestionnaire de secrets, jamais dans le dépôt Git.

## 3.3 Exigences de sécurité

- HTTPS obligatoire.
- PostgreSQL non exposé directement sur Internet.
- Mot de passe administrateur principal robuste.
- Comptes utilisateurs individuels.
- Droits minimaux nécessaires.
- Sauvegarde de la base et du filestore.
- Surveillance de la disponibilité du service.
- Journalisation des erreurs.
- Protection des interfaces d'administration.
- Politique de mise à jour et de restauration.

La configuration de production doit tenir compte du mode proxy et des paramètres de workers Odoo. Les exigences officielles de déploiement détaillent notamment HTTPS, PostgreSQL et le dimensionnement des workers.

# 4. Configuration fonctionnelle Odoo

## 4.1 Applications à installer

| Application            | Utilisation                                  | Priorité |
| ---------------------- | -------------------------------------------- | -------- |
| CRM                    | Gestion des prospects et des opportunités    | P0       |
| Contacts               | Gestion des demandeurs et partenaires        | P0       |
| Calendrier / Activités | Appels et relances                           | P0       |
| Ventes                 | Suivi commercial complémentaire              | P2       |
| Helpdesk               | Réclamations et assistance après réservation | P3       |

Le premier déploiement doit rester concentré sur CRM, Contacts et Activités.

## 4.2 Organisation des équipes

Créer une équipe commerciale :

**Nom :** EduLoc — Relation client

Configuration initiale :

- 1 responsable d'équipe ;
- 2 à 5 agents ;
- attribution manuelle ou répartition par responsable ;
- visibilité adaptée aux rôles.

Les agents doivent disposer de comptes individuels.

## 4.3 Rôles

| Rôle                        | Permissions                                           |
| --------------------------- | ----------------------------------------------------- |
| Administrateur Odoo         | Configuration générale et gestion des accès           |
| Responsable relation client | Consultation globale, attribution et suivi des agents |
| Agent                       | Consultation et traitement des dossiers autorisés     |

Les règles d'accès doivent être testées avec de vrais comptes de chaque rôle.

Un agent ne doit pas disposer de droits administratifs simplement parce qu'il traite des demandes.

## 4.4 Pipeline CRM

Créer un pipeline adapté à l'activité éducative.

| Étape               | Signification                       |
| ------------------- | ----------------------------------- |
| Nouvelle demande    | Demande reçue du site               |
| À qualifier         | Informations à compléter            |
| En recherche        | Recherche d'une solution éducative  |
| Proposition envoyée | Solution proposée au demandeur      |
| En attente          | Réponse ou information attendue     |
| Convertie           | Une réservation EduLoc a été créée  |
| Sans suite          | Demande abandonnée ou non convertie |

La clôture doit être accompagnée d'un motif lorsque la demande n'aboutit pas.

Les étapes CRM ne doivent pas reproduire les états des réservations EduLoc.

## 4.5 Informations du dossier CRM

Chaque dossier doit permettre de retrouver :

**Informations du demandeur**

- Nom.
- Téléphone.
- Adresse e-mail.
- Canal de contact préféré.

**Besoin éducatif**

- Type de demande.
- Niveau scolaire.
- Matière.
- Format souhaité.
- Fréquence souhaitée.
- Ville ou zone géographique.
- Informations complémentaires.

**Suivi**

- Agent responsable.
- Date de réception.
- Étape actuelle.
- Prochaine action.
- Date de prochaine relance.
- Historique des interactions.
- Motif de clôture.

Les champs obligatoires doivent rester limités aux informations nécessaires pour traiter correctement le dossier.

Les informations personnelles détaillées d'un bénéficiaire mineur ne doivent pas être collectées inutilement dans le CRM.

# 5. Intégration du site vitrine

## 5.1 Fonctionnement actuel à préserver

Le site vitrine propose un assistant guidé qui permet notamment au visiteur d'indiquer :

- s'il cherche un tuteur pour lui-même ou un proche ;
- le niveau ;
- la matière ;
- le format ;
- la fréquence ;
- la ville ;
- ses coordonnées ;
- sa préférence de contact.

Le formulaire enregistre actuellement une demande dans `support_requests`.

Cette fonctionnalité doit rester opérationnelle pendant l'intégration.

## 5.2 Flux de transmission

```
1. Le visiteur soumet le formulaire
              |
              v
2. Le backend enregistre la demande
              |
              v
3. La demande est identifiée
              |
              v
4. Le backend transmet les données à Odoo
              |
              v
5. Odoo crée ou retrouve le contact
              |
              v
6. Odoo crée une piste CRM
              |
              v
7. L'identifiant Odoo est enregistré
              |
              v
8. La synchronisation passe à SUCCESS
```

Le visiteur doit recevoir une confirmation uniquement après l'enregistrement réussi de sa demande dans le système du site.

La disponibilité d'Odoo ne doit pas conditionner la réception initiale du formulaire.

## 5.3 Mapping des données

| Champ du site                | Destination Odoo        |
| ---------------------------- | ----------------------- |
| Nom du demandeur             | Contact / Nom           |
| Téléphone                    | Contact / Téléphone     |
| E-mail                       | Contact / E-mail        |
| Type de demande              | Champ CRM personnalisé  |
| Niveau                       | Champ CRM personnalisé  |
| Matière                      | Champ CRM personnalisé  |
| Format                       | Champ CRM personnalisé  |
| Fréquence                    | Champ CRM personnalisé  |
| Ville                        | Champ CRM personnalisé  |
| Préférence de contact        | Champ CRM personnalisé  |
| Informations complémentaires | Description de la piste |
| Référence du formulaire      | Référence externe       |

Le mapping exact devra être adapté aux noms de champs réellement présents dans `support_requests`.

## 5.4 Identification des doublons

Prévoir une stratégie de rapprochement des contacts.

Ordre de recherche recommandé :

1. E-mail normalisé.
2. Numéro de téléphone normalisé.
3. Création d'un nouveau contact si aucun résultat fiable n'existe.

Une demande supplémentaire d'un même contact ne doit pas être supprimée automatiquement.

Chaque soumission doit pouvoir correspondre à un dossier CRM distinct, même si le contact existe déjà.

## 5.5 Idempotence

Chaque demande doit posséder une référence externe unique.

Exemple :

```
EDULOC-SUPPORT-2026-000123
```

Si la transmission est répétée à cause d'une panne réseau, Odoo ne doit pas créer deux pistes pour la même soumission.

Le backend doit vérifier cette référence avant de créer un nouvel enregistrement.

# 6. Backend d'intégration

## 6.1 Responsabilités

Le backend d'intégration doit :

- recevoir ou détecter les nouvelles demandes ;
- valider les informations ;
- normaliser les données ;
- rechercher les doublons ;
- communiquer avec Odoo ;
- conserver les identifiants de correspondance ;
- journaliser les tentatives ;
- permettre une nouvelle tentative en cas d'échec.

## 6.2 Table technique de synchronisation

Créer une table dédiée, par exemple :

`odoo_sync_logs`

| Champ              | Type indicatif    | Description                  |
| ------------------ | ----------------- | ---------------------------- |
| id                 | UUID              | Identifiant                  |
| support_request_id | UUID              | Demande du site              |
| odoo_lead_id       | Integer nullable  | Identifiant de la piste Odoo |
| odoo_partner_id    | Integer nullable  | Identifiant du contact       |
| external_reference | String unique     | Référence externe            |
| sync_status        | Enum              | État de synchronisation      |
| attempt_count      | Integer           | Nombre de tentatives         |
| last_error         | Text nullable     | Dernière erreur              |
| last_attempt_at    | DateTime nullable | Dernière tentative           |
| synced_at          | DateTime nullable | Date de réussite             |
| created_at         | DateTime          | Création                     |

États possibles :

```
PENDING
SUCCESS
FAILED
```

Cette table doit permettre d'identifier les demandes non transmises sans devoir consulter manuellement les journaux du serveur.

## 6.3 Stratégie de reprise

- Enregistrer la demande avant de contacter Odoo.
- Si Odoo est indisponible, conserver l'état PENDING ou FAILED selon la politique retenue.
- Réessayer avec un délai progressif.
- Ne jamais supprimer une demande en raison d'une erreur Odoo.
- Garantir l'idempotence.
- Permettre une reprise manuelle par un administrateur.

## 6.4 API Odoo

Deux options techniques sont à étudier :

**Option A — API externe native**

Utiliser l'API JSON-2 d'Odoo 19 si elle est disponible et autorisée dans l'édition et le déploiement retenus.

**Option B — Module personnalisé**

Développer un module Odoo `eduloc_integration` qui expose un endpoint sécurisé pour recevoir les demandes du site.

Le module personnalisé devra :

- authentifier les requêtes ;
- valider les données ;
- contrôler la référence externe ;
- créer ou retrouver le contact ;
- créer la piste CRM ;
- retourner les identifiants Odoo ;
- retourner une erreur explicite en cas d'échec.

Le choix entre ces options doit être validé avant le développement de la passerelle.

Une clé d'API ne doit jamais être exposée dans le frontend public.

# 7. Parcours métier de l'agent

## 7.1 Réception

L'agent consulte les nouvelles demandes dans son espace CRM.

Il doit pouvoir :

- consulter les coordonnées ;
- comprendre le besoin ;
- identifier la date de réception ;
- prendre en charge le dossier.

## 7.2 Qualification

L'agent contacte le demandeur pour compléter les informations manquantes.

Il peut :

- enregistrer un appel ;
- ajouter une note ;
- modifier les informations du dossier ;
- planifier une relance ;
- changer l'étape du pipeline.

## 7.3 Recherche d'une solution

L'agent utilise EduLoc pour rechercher un tuteur adapté.

À ce stade, la recherche de tuteurs reste réalisée dans la plateforme EduLoc.

Odoo ne doit pas devenir une copie de la base des tuteurs.

## 7.4 Proposition

L'agent communique la proposition au demandeur et consigne l'action dans Odoo.

## 7.5 Conversion

Lorsqu'une réservation est effectivement créée dans EduLoc, l'agent peut marquer le dossier CRM comme converti.

Pendant la première phase, cette opération peut être manuelle.

La synchronisation automatique sera étudiée dans une phase ultérieure.

# 8. Sécurité et confidentialité

Les informations des demandeurs et les informations concernant les bénéficiaires doivent être traitées avec prudence.

Exigences :

- comptes individuels ;
- authentification obligatoire pour les agents ;
- droits d'accès limités ;
- HTTPS ;
- secrets conservés côté serveur ;
- journalisation des opérations ;
- sauvegardes régulières ;
- politique de conservation des données ;
- procédure de désactivation d'un agent ;
- absence d'accès public aux dossiers CRM.

Le module d'intégration ne doit pas utiliser un compte administrateur Odoo.

Créer un compte technique dédié avec uniquement les permissions nécessaires à la création et à la consultation des contacts et pistes concernés.

# 9. Tests et critères d'acceptation

## 9.1 Tests fonctionnels

- Une demande valide est transmise à Odoo.
- Le contact est correctement créé.
- Une piste CRM est créée.
- Les informations du formulaire sont correctement mappées.
- Une demande supplémentaire du même contact ne crée pas un contact inutilement dupliqué.
- Les agents peuvent consulter leurs dossiers autorisés.
- Le responsable peut attribuer une demande.
- Une activité de relance peut être planifiée.
- Un dossier peut être clôturé avec un motif.
- Un dossier converti conserve sa référence de réservation lorsqu'elle est disponible.

## 9.2 Tests techniques

- Odoo indisponible pendant une soumission.
- Erreur d'authentification API.
- Données invalides.
- Référence externe déjà utilisée.
- Répétition d'une requête.
- Échec de création du contact.
- Échec de création de la piste.
- Reprise après indisponibilité.
- Sauvegarde et restauration de la base Odoo.

## 9.3 Critères de validation

La fonctionnalité sera considérée comme validée lorsque :

1. Toute demande acceptée par le site est conservée.
2. Les demandes sont transmises à Odoo sans duplication.
3. Les erreurs de synchronisation sont visibles.
4. Les agents peuvent traiter les demandes.
5. Les rôles et permissions sont respectés.
6. Le fonctionnement du site reste indépendant d'une panne temporaire d'Odoo.

# 10. Découpage du développement

## Phase 1 — Infrastructure

- Préparer le VPS.
- Installer Docker et Docker Compose.
- Déployer PostgreSQL.
- Déployer Odoo.
- Configurer Nginx.
- Configurer HTTPS.
- Préparer les sauvegardes.
- Créer les environnements de test et production.

**Livrable :** instance Odoo accessible et sécurisée.

## Phase 2 — Configuration CRM

- Installer CRM et Contacts.
- Créer l'équipe EduLoc.
- Créer les comptes des agents.
- Définir les rôles.
- Configurer le pipeline.
- Créer les champs spécifiques.
- Configurer les activités.

**Livrable :** CRM utilisable sans intégration au site.

## Phase 3 — Intégration

- Auditer la structure de `support_requests`.
- Définir le mapping.
- Choisir l'API.
- Développer la passerelle.
- Développer la logique anti-doublon.
- Ajouter les journaux de synchronisation.
- Tester les reprises.

**Livrable :** transmission automatique des demandes du site vers Odoo.

## Phase 4 — Validation opérationnelle

- Créer des demandes de test.
- Former les agents.
- Tester les parcours métier.
- Corriger les problèmes.
- Déployer progressivement.

**Livrable :** processus de traitement des demandes opérationnel.

# 11. Hors périmètre et évolutions futures

Les fonctionnalités suivantes ne doivent pas bloquer la première mise en production :

- synchronisation automatique des réservations ;
- gestion des tuteurs depuis Odoo ;
- gestion des bénéficiaires depuis Odoo ;
- espace agent web spécifique ;
- gestion des réclamations après réservation ;
- automatisation des notifications ;
- facturation et comptabilité ;
- tableaux de bord commerciaux avancés.

Ces fonctionnalités seront étudiées après validation du premier flux.

---

# 12. Décisions techniques restant à confirmer

| Décision                               | État           |
| -------------------------------------- | -------------- |
| Auto-hébergement                       | Validé         |
| Équipe de 2 à 5 agents                 | Validé         |
| Périmètre relation client              | Validé         |
| Odoo Community ou Enterprise           | À confirmer    |
| Version Odoo 19                        | Cible proposée |
| VPS et fournisseur                     | À choisir      |
| Domaine Odoo                           | À choisir      |
| API JSON-2 ou module personnalisé      | À confirmer    |
| Structure exacte de `support_requests` | À auditer      |
| Attribution automatique ou manuelle    | À configurer   |
| Politique de conservation des demandes | À définir      |

**Principe directeur :** commencer par faire fonctionner parfaitement le parcours « demande du site → dossier CRM → traitement par un agent ». Les intégrations supplémentaires ne seront ajoutées que lorsqu'un besoin métier réel les justifiera.

## Références techniques à utiliser

Les points suivants sont importants avant de lancer l'installation :

- [Documentation officielle Odoo 19 — Déploiement](https://www.odoo.com/documentation/19.0/fr/administration/on_premise/deploy.html?utm_source=chatgpt.com) : HTTPS, reverse proxy, PostgreSQL, workers et configuration serveur.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://www.odoo.com\&sz=32)

  Documentation Odoo 19.0

- [Documentation officielle — Installation](https://www.odoo.com/documentation/19.0/fr/administration/on_premise/source.html?utm_source=chatgpt.com) : dépendances et PostgreSQL 13 minimum pour Odoo 19.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://www.odoo.com\&sz=32)

  Documentation Odoo 19.0

- [Documentation officielle — API JSON-2](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html?utm_source=chatgpt.com) : authentification Bearer, permissions et appels API.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://www.odoo.com\&sz=32)

  Odoo 19.0 documentation+1



Une précision importante sur l'API : Odoo 19 introduit JSON-2, mais sa documentation indique une restriction d'accès à l'API externe selon le plan. Il ne faut donc pas construire la passerelle en supposant que cette API sera automatiquement disponible. Le module personnalisé `eduloc_integration` constitue une solution de repli à évaluer, particulièrement avec Community.

## Mon conseil pour la suite

Ne commence pas par générer le module personnalisé. Fais d'abord installer Odoo, configure manuellement le CRM et crée quelques dossiers fictifs. Cela permettra de vérifier que le pipeline correspond réellement au travail des agents.

Ensuite, la première tâche de développement pourra être l'audit du formulaire Lovable et de la table `support_requests`, afin de produire un contrat d'intégration précis entre ton site et Odoo.