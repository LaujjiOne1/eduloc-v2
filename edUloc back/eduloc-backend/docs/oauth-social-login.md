# Connexion sociale (Google, Apple, Facebook)

Pas de service d'authentification tiers : le backend vérifie lui-même le jeton que l'application obtient auprès du
fournisseur, puis ouvre une session EduLoc ordinaire (jeton d'accès 15 min + jeton de rafraîchissement renouvelé).

## Contrat

`POST /api/auth/oauth/exchange` (public, limité à 20 essais / 15 min / IP)

```json
{ "provider": "google | apple | facebook", "token": "…", "nonce": "…", "firstName": "…", "lastName": "…" }
```

| Fournisseur | `token` | Vérification côté serveur |
|---|---|---|
| Google | jeton d'identité (`idToken`) | RS256 contre `googleapis.com/oauth2/v3/certs`, `iss`, `aud` ∈ `GOOGLE_CLIENT_IDS`, `exp` |
| Apple | jeton d'identité (`identityToken`) | RS256 contre `appleid.apple.com/auth/keys`, `iss`, `aud` ∈ `APPLE_CLIENT_IDS`, `exp` |
| Facebook | jeton d'accès | Graph `debug_token` (valide, `app_id` = notre application, non expiré) puis `/me` (même `id`) |

`nonce` (facultatif, recommandé) : valeur brute envoyée au fournisseur ; le jeton doit la contenir telle quelle ou en
SHA-256 hexadécimal. `firstName` / `lastName` : Apple ne donne le nom qu'à la première autorisation, l'application le
transmet ; ils ne servent qu'à la création du compte.

Réponse : celle de `/auth/login` (`accessToken`, `refreshToken`, `refreshExpiresAt`, `user`) + `created` (compte créé à l'instant).

| Statut | Code | Sens |
|---|---|---|
| 401 | `OAUTH_TOKEN_INVALID` | jeton invalide, expiré, d'une autre application, signature fausse |
| 503 | `OAUTH_PROVIDER_DISABLED` | fournisseur non configuré côté serveur |
| 422 | `OAUTH_EMAIL_REQUIRED` | le fournisseur n'a pas communiqué d'e-mail |
| 422 | `OAUTH_EMAIL_UNVERIFIED` | e-mail non attesté par le fournisseur |
| 403 | `OAUTH_LINK_FORBIDDEN` | l'e-mail est celui d'un administrateur : pas de liaison automatique |
| 403 | `ACCOUNT_DISABLED` | compte suspendu ou supprimé |

## Liaison des comptes

Table `oauth_accounts` (1 compte → N fournisseurs), unique sur `(provider, providerUserId)`. L'e-mail n'est qu'un indice.

1. « fournisseur + identifiant » déjà lié → connexion (même si l'e-mail a changé chez le fournisseur).
2. Sinon, e-mail connu **et attesté** → on lie ce fournisseur au compte existant.
3. Sinon, e-mail inconnu et attesté → création d'un compte actif, vérifié, **sans mot de passe** (`users.password` est
   désormais nullable ; un tel compte ne se connecte jamais par mot de passe, mais peut en définir un via « mot de passe
   oublié »).

Garde-fous (tous testés, `test/unit/oauth.spec.ts` et `test/integration/oauth.int.spec.ts`) :

- jamais de liaison ni de création sans e-mail **attesté** (`email_verified` pour Google et Apple) ;
- jamais de liaison automatique à un administrateur ;
- compte jamais vérifié : la liaison l'active **et efface son mot de passe** (il a pu être posé par quelqu'un qui n'avait
  pas accès à la boîte mail) ;
- deux connexions simultanées du même nouveau compte ne créent qu'un compte (unicité + relecture) ;
- algorithme imposé RS256 (ni `none`, ni HS256) ; sans clés joignables, le jeton est refusé.

Spécificités : Apple n'envoie l'e-mail qu'une fois et peut le masquer (relais `privaterelay.appleid.com`) — il est
enregistré dans `oauth_accounts.email`, mais la clé reste l'identifiant Apple. **Hypothèse à connaître** : Facebook ne
renvoie qu'une adresse qu'il a confirmée ; elle est traitée comme attestée. Si ce risque n'est pas acceptable, passer
`emailVerified` à `false` pour Facebook dans `identity-resolver.ts` (la liaison et la création par e-mail seront alors
refusées pour ce fournisseur).

## Configuration (.env)

```
GOOGLE_CLIENT_IDS=<client web>,<client android>,<client ios>   # destinataires (aud) acceptés
APPLE_CLIENT_IDS=<bundle id de l'app>                           # (+ Services ID si connexion web)
FACEBOOK_APP_ID=…
FACEBOOK_APP_SECRET=…
```

Un fournisseur est actif dès qu'il est configuré. Rien n'est accepté par défaut.

- **Google** : Google Cloud Console → identifiants OAuth (un client par plateforme) ; renseigner leurs identifiants.
- **Apple** : programme développeur payant (99 $/an), « Sign in with Apple » activé sur l'identifiant d'app.
- **Facebook / Meta** : application Meta for Developers, produit « Facebook Login », permissions `public_profile` et
  `email` ; l'application doit passer en mode « Live » pour d'autres comptes que les testeurs.

## Migration

`prisma/migrations/20261031120000_oauth_accounts` (additive : enum, table, `password` nullable). Rollback :
`prisma/rollbacks/20261031_oauth_accounts.down.sql` (remettre `NOT NULL` échoue tant qu'un compte sans mot de passe existe).
Non appliquée à la base de développement : sauvegarde (`pg_dump`) puis `prisma migrate deploy`.
