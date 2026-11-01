# Choix technologiques par phase

Principe : **n'ajouter une technologie que lorsque la phase qui en a besoin démarre**, et réutiliser d'abord ce que le backend possède déjà.
Constaté dans le dépôt : NestJS, Prisma, PostgreSQL + PostGIS + pgvector, Redis (`ioredis`), `@nestjs/schedule`, outbox d'événements
(`OutboxEvent`, `src/infrastructure/outbox`), push Firebase, Centrifugo (temps réel), LiveKit (audio/appels), Ollama (embeddings, génération).
Absents : BullMQ, Temporal, Novu, ClickHouse, Superset.

## 1. Décision par brique

| Brique | Proposition reçue | **Choix** | Quand | Pourquoi |
|---|---|---|---|---|
| Délais (expiration T1/T2, 15 min de conflit, 24 h de clôture, relances) | Temporal ou BullMQ | **BullMQ** (Redis déjà là) avec jobs différés idempotents ; l'état fait foi en base, le job ne fait que le constater | Étape 3 | Les délais sont courts à moyens et rattrapables en relisant la base. Temporal ajoute un cluster à exploiter pour peu de gain |
| | | Temporal | Seulement si > ~10 workflows longs imbriqués ou besoin d'historique d'exécution | À réévaluer après le pilote, jamais avant |
| Notifications multicanal | Novu | **Outbox actuelle + Firebase** (push) ; e-mail et WhatsApp en **adaptateurs** derrière une interface `Notifier` | Push : maintenant ; e-mail : étape 3 ; WhatsApp : étape 5 | Une nouvelle plateforme (Novu) = base, files, interface à sécuriser. L'outbox existe déjà |
| | | Novu | À réévaluer si > 3 canaux et modèles de messages gérés par des non-développeurs | |
| WhatsApp | API officielle Meta ou Evolution API | **API WhatsApp Business Cloud officielle** (ou prestataire agréé) | Étape 5 | **Éviter Evolution API / Baileys** : non officiel, contraire aux conditions de Meta, risque de bannissement du numéro |
| CRM | (Odoo déjà décidé) | **Odoo** pour relances, tâches, réclamations | Étape 5 | Inchangé |
| Matching et remplaçants | PostgreSQL + pgvector | **PostgreSQL + pgvector** (déjà en place : `TutorSearchChunk`, `matching`) | Existe ; amélioration étape 6 | L'éligibilité reste en règles SQL ; les embeddings ne servent qu'au classement |
| Recherches sans résultat | Table `failed_searches` | **Table PostgreSQL** `failed_searches` + événement outbox | Étape 3 | Simple, interrogeable depuis Odoo ; voir §3 pour la vie privée |
| Analyse | ClickHouse + Superset | **Vues SQL + tableau de bord dans l'Office** | Étape 6 | ClickHouse/Superset seulement si le volume ou les requêtes ralentissent PostgreSQL |
| Voix IA | LiveKit Agents + Ollama + Faster-Whisper + Kokoro | **Reporté après le pilote** ; si lancé : LiveKit Agents + Faster-Whisper + LLM local ou API | Après P8 | Voir §2 : langue, consentement et coût à valider d'abord |

## 2. Voix IA : points à vérifier avant d'engager le chantier

- **Langue** : Whisper reconnaît le malgache avec une qualité nettement inférieure au français. Kokoro et XTTS v2 proposent des voix françaises, **pas de voix malgache fiable**. À tester avec des enregistrements réels avant tout engagement.
- **Rôle limité** : appel de **rappel / confirmation** (« confirmez-vous le cours de demain ? ») et prise d'informations, jamais de décision financière (remboursement, litige) ni de promesse hors règles.
- **Consentement et données** (D-12, D-17) : information de l'appelé qu'il parle à une IA, pas d'enregistrement audio en v1, transcriptions minimisées.
- **Latence et coût** : mesurer la latence de bout en bout (cible < 1,5 s par échange) et le coût par appel entre modèle local (Ollama) et API ; le matériel local doit supporter appels simultanés **et** embeddings.
- **Téléphonie** : relier le réseau téléphonique à LiveKit demande un trunk SIP d'un opérateur local ; faisabilité et tarifs à vérifier.
- **Repli** : toujours une voie vers un conseiller humain.

## 3. Recherches sans résultat (`failed_searches`)

À enregistrer : matière, niveau, zone (arrondie à un quartier), date/heure souhaitées, format, horodatage, identifiant de session **ou** d'utilisateur.
Pas de texte libre brut conservé sans durée limite (peut contenir des données personnelles) ; rétention à fixer (ex. 12 mois), agrégation ensuite.
Usage : alimenter une liste d'attente, **alerter** quand des tuteurs correspondants deviennent disponibles, repérer les zones/horaires mal couverts (D-19).
Appel côté application : `POST /api/failed-searches` avec limitation de débit et dédoublonnage (même critère, même session, 10 min) pour éviter le bruit.

## 4. Délais : modèle à respecter quel que soit l'outil

- La base porte l'échéance (`expiresAt`) ; le job planifié **relit l'état** puis agit. Si le job est perdu, une tâche de balayage périodique rattrape.
- Jobs identifiés par une clé unique (`booking:<id>:expire`) → un seul actif ; annulés ou ignorés si l'état a changé.
- Le « 2 h » de la proposition n'est qu'un exemple : la durée de validité est **libre mais bornée** (D-03).
- Instances multiples du backend : un seul worker exécute chaque job (verrou Redis ou file BullMQ), testé (TP-BKG-06).

## 5. Technologies par étape de l'ordre de développement

| Étape | Technologies utilisées | Nouvelles dépendances |
|---|---|---|
| 1 Socle | NestJS, Prisma, outbox existante, GitHub Actions | aucune |
| 2 Paramètres, machine d'états | PostgreSQL, Prisma, Office (admin) | aucune |
| 3 Réservation, paiement | **BullMQ** (Redis), PostgreSQL (verrous, contrainte d'exclusion), service de paiement + adaptateur Mobile Money, e-mail transactionnel, table `failed_searches` | `bullmq`, bibliothèque d'envoi d'e-mails |
| 4 Séance, reversement | Centrifugo (présence, temps réel), LiveKit (séances en ligne), PostgreSQL | aucune |
| 5 Canaux, opérations | Odoo + connecteur d'événements signés, **WhatsApp Business Cloud API**, Firebase push | client WhatsApp |
| 6 Pilotage | Vues SQL, tableau de bord Office, pgvector (classement, remplaçants) | aucune |
| Après le pilote | Voix IA (LiveKit Agents, Faster-Whisper, TTS), ClickHouse/Superset, Temporal : chacun sur démonstration d'un besoin | selon décision |

## 6. Critères pour réévaluer un choix reporté

| Technologie | Déclencheur mesuré |
|---|---|
| Temporal | Workflows longs multiples dont l'état ne se reconstruit pas depuis la base |
| Novu | Plus de 3 canaux, ou besoin de modèles de messages éditables sans développeur |
| ClickHouse / Superset | Requêtes analytiques > 2 s sur PostgreSQL ou > 50 M d'événements |
| Voix IA | Tests de langue concluants + consentement validé + coût par appel acceptable |

## 7. Décisions à ajouter à la liste

| ID | Sujet | Priorité |
|---|---|---|
| D-21 | Canal e-mail : prestataire d'envoi et domaine expéditeur | P1 (étape 3) |
| D-22 | WhatsApp : numéro dédié, compte Meta Business vérifié, modèles de messages | P1 (étape 5) |
| D-23 | Rétention de `failed_searches` et consentement | P1 (étape 3) |
| D-24 | Voix IA : langues, périmètre des appels, SIP | P2 (après pilote) |
