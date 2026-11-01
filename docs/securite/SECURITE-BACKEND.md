# Sécurité du backend EduLoc

Exigences, contrôles automatisés (CI) et checklist de revue. Les identifiants SEC-xx reprennent ceux déjà cités dans
`edUloc back/eduloc-backend/docs/payments-integration.md`.

## 1. Menaces prioritaires pour EduLoc

| Menace | Impact | Contrôle principal |
|---|---|---|
| Fraude au paiement (montant ou statut forgé côté client) | Perte financière | Montant calculé serveur, ticket signé, webhook signé, revérification serveur à serveur |
| Double réservation / course sur créneau | Litige, perte de confiance | Contrainte d'exclusion en base + transaction |
| Accès à la donnée d'autrui (IDOR) sur bénéficiaires, mineurs, réservations | Atteinte à la vie privée | Contrôle de propriété à chaque route, tests TP-BKG-03 |
| Escalade de privilèges (agent, admin) | Compromission | RBAC strict, rôle `AGENT` borné, audit |
| Fuite de secrets | Compromission totale | Variables d'environnement serveur, scan de secrets en CI |
| Vol de session | Prise de compte | JWT court (15 min), refresh token tournant et révocable, Argon2 |
| Injection (SQL, requêtes géographiques) | Fuite de données | Prisma paramétré, SQL brut paramétré seulement, DTO validés |
| Abus de l'API (force brute, scraping, SMS/e-mail) | Coût, indisponibilité | Limitation de débit par IP et par compte, quotas de notifications |
| Webhook falsifié ou rejoué | Faux paiements | HMAC, horodatage, idempotence |
| Fichiers malveillants (CV, justificatifs) | Exécution, fuite | Type/taille/contenu validés, stockage hors racine web, analyse |
| Chaîne d'approvisionnement | Code malveillant | Verrouillage des versions, audit npm, Dependabot, SBOM |
| Données d'enfants | Obligation renforcée | Minimisation, accès restreint, journalisation des accès |

## 2. Exigences (à respecter dans le code)

**Authentification et sessions**
- Mot de passe : Argon2 (déjà utilisé). Jamais de journalisation de mot de passe ou de jeton.
- Jeton d'accès 15 min ; refresh token stocké haché, rotation à chaque usage, révocation à la déconnexion et à la suspension.
- Comptes suspendus (`UserStatus`) refusés immédiatement, y compris avec un jeton encore valide (vérification d'état à chaque requête sensible).

**Autorisation**
- Une garde par route + une vérification de **propriété** dans le service (jamais seulement dans la garde).
- Rôles : demandeur, tuteur, partenaire, admin, `AGENT` (nouveau, permissions minimales, audité).
- Le client n'envoie jamais un montant, un statut, un identifiant d'acteur ni un rôle comme argument de confiance.

**Entrées**
- Chaque DTO validé (`class-validator` / `zod`), liste blanche des champs, taille maximale des corps.
- SQL brut uniquement paramétré. Aucun gabarit de requête construit par concaténation.

**Paiement (SEC-01..06, MM-01..04)**
- HTTPS obligatoire en production pour `PAY_PUBLIC_URL`.
- `PAY_TICKET_SECRET` ≠ `PAY_WEBHOOK_SECRET`, ≥ 32 caractères, hors dépôt. Rotation planifiée, ancien secret accepté pendant une fenêtre courte.
- Comparaison de signatures en temps constant, horodatage + fenêtre de tolérance, idempotence par identifiant de paiement.
- Aucune donnée de carte dans EduLoc.

**Webhooks et intégration Odoo**
- Signature HMAC par message, `event_id` unique, rejeu autorisé mais sans effet double.
- Jeton de service Odoo distinct du jeton utilisateur, droits minimaux, révocable, restreint par IP si possible.

**Réseau et exécution**
- `helmet` actif (déjà), CORS en liste blanche en production (déjà), limitation de débit globale + stricte sur `/auth`, `/payments`, recherche.
- Conteneur non root (déjà `USER node`), image minimale, pas de secrets dans l'image, `HEALTHCHECK` (déjà).
- Migrations exécutées dans une étape de déploiement distincte, jamais au démarrage.
- Base : utilisateur applicatif sans droit DDL en production ; sauvegardes chiffrées, restauration testée.

**Données et journaux**
- Journaux sans donnée personnelle superflue ni jeton ; identifiant de corrélation par requête.
- Journal d'audit en ajout seul pour : validations, suspensions, remboursements, décisions de litige, actions d'agent.
- Rétention définie ; suppression/anonymisation sur demande.

## 3. Contrôles automatisés (`.github/workflows/backend-security.yml`)

| Contrôle | Outil | Déclenchement | Bloque la fusion |
|---|---|---|---|
| Dépendances vulnérables | `npm audit --omit=dev --audit-level=high` | PR, hebdomadaire | oui |
| Secrets dans le dépôt | Gitleaks | PR, push | oui |
| Analyse statique | CodeQL (JavaScript/TypeScript) | PR, hebdomadaire | oui |
| Image Docker | Trivy (HIGH, CRITICAL, correctifs disponibles) | PR (image), release | oui |
| Configuration Docker/CI | Trivy config | PR | oui |
| Inventaire des composants | SBOM (CycloneDX) archivé | release | non |
| Mises à jour | Dependabot (npm, Docker, Actions) | hebdomadaire | non |

## 4. Checklist de revue d'une PR

- [ ] Chaque route a une garde **et** une vérification de propriété.
- [ ] Aucun montant/statut/rôle pris dans le corps de la requête sans recalcul serveur.
- [ ] Opérations sur créneau ou argent dans une transaction, avec verrou ou contrainte de base.
- [ ] Idempotence pour tout ce qui est rejouable (webhook, tâche planifiée, événement sortant).
- [ ] Nouveaux DTO validés ; pas de SQL concaténé.
- [ ] Pas de secret, jeton, donnée personnelle dans les logs ou les erreurs renvoyées.
- [ ] Limitation de débit ajoutée sur les routes sensibles.
- [ ] Tests négatifs écrits (accès interdit, signature fausse, rejeu).
- [ ] Nouvelle variable d'environnement documentée dans `.env.example`, validée au démarrage.
- [ ] Journal d'audit alimenté pour les actions d'admin/agent.

## 5. Gestion des secrets

- Développement : `.env` local non versionné, `.env.example` sans valeur réelle.
- CI : secrets GitHub (par environnement `staging` / `production`), jamais en clair dans les journaux.
- Production : gestionnaire de secrets ou variables du serveur ; accès nominatif ; rotation au minimum annuelle et à chaque départ.
- Fuite suspectée : révoquer et remplacer d'abord, enquêter ensuite.

## 6. Réponse à incident (version minimale)

1. Contenir (couper la fonctionnalité via son drapeau, révoquer les clés).
2. Préserver (journaux, base en lecture).
3. Corriger et déployer.
4. Informer les personnes concernées si des données personnelles sont touchées.
5. Rédiger un bilan sans recherche de coupable et créer les tâches de prévention.

## 7. Exceptions acceptées

| Date | Alerte | Justification | Échéance |
|---|---|---|---|
| (aucune) | | | |

Toute exception se consigne ici avec une échéance ; sans entrée, la CI reste rouge.
