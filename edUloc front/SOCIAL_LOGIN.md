# Connexion sociale — Google et Facebook (Apple mis de côté)

## Ce qui est fait
- Boutons **Google** et **Facebook** sur l'écran de connexion et sur celui d'inscription
  (`src/components/ui/social-auth-buttons.tsx`). Le même bouton connecte ou crée le compte : le serveur lie ou crée
  (`POST /auth/oauth/exchange`, voir `edUloc back/eduloc-backend/docs/oauth-social-login.md`).
- SDK natifs installés et branchés (`src/lib/social-auth-native.ts`, appelé au démarrage par `src/app/_layout.tsx`) :
  - Google : `@react-native-google-signin/google-signin` → jeton d'identité (`idToken`) ;
  - Facebook : `react-native-fbsdk-next` → jeton d'accès, contrôlé par le serveur auprès de l'API Graph.
- Un fournisseur n'est branché que si sa clé est présente (sinon son bouton répond « Cette connexion n'est pas encore
  disponible »). Les modules natifs sont chargés à la demande : un ancien build sans eux ne plante pas.
- Plugins ajoutés par `app.config.ts` (et non `app.json`) : le plugin Facebook refuse de s'exécuter sans identifiant
  d'application ; sans clés, le build reste valable (identifiant factice, connexion indisponible).
- Un compte créé ainsi est déjà vérifié : pas de code à saisir. « Rester connecté » et les comptes de l'appareil s'appliquent.

## Apple : pas affiché
Il demande le programme développeur payant (99 $/an). Le serveur sait déjà le vérifier ; il manque seulement le bouton et
l'adaptateur (`expo-apple-authentication`, voir le commentaire de `social-auth-buttons.tsx`).
**Avant une publication sur l'App Store** : une application iOS qui propose Google ou Facebook DOIT aussi proposer
« Se connecter avec Apple » (règle d'Apple). Sur Android, aucune obligation.

## À faire pour que ça marche (rien de tout cela n'a pu être fait depuis le code)

### 1. Google
1. Google Cloud Console → projet → écran de consentement OAuth, puis **Identifiants → Créer des identifiants → ID client OAuth** :
   - un client **Web** → son identifiant est `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` **et** à mettre dans `GOOGLE_CLIENT_IDS` du backend
     (le jeton est émis pour ce client : c'est lui que le serveur contrôle) ;
   - un client **Android** : package `mg.eduloc.app` + empreinte **SHA-1** du certificat de signature (celle du build :
     `eas credentials`, ou `./gradlew signingReport` pour un build local). Sans lui, `signIn` échoue (`DEVELOPER_ERROR`) ;
   - (iOS plus tard) un client **iOS** → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
2. Un SHA-1 par clé de signature utilisée (développement, EAS, Play Store).

### 2. Facebook (Meta)
1. developers.facebook.com → créer une application (type « Consommateur ») → ajouter le produit **Facebook Login**.
2. Paramètres → De base : `EXPO_PUBLIC_FACEBOOK_APP_ID` (ID de l'app), `FACEBOOK_APP_SECRET` (serveur seulement), et
   **Paramètres → Avancé → Jeton client** → `FACEBOOK_CLIENT_TOKEN`.
3. Ajouter la plateforme **Android** : package `mg.eduloc.app`, activité de lancement `mg.eduloc.app.MainActivity`, et le
   **hachage de clé** (Key Hash) du certificat de signature.
4. Permissions : `public_profile` et `email` (sans validation). Tant que l'application est en mode « Développement », seuls les
   comptes ajoutés comme testeurs peuvent se connecter ; il faut la passer en « Live » (politique de confidentialité exigée).

### 3. Variables d'environnement
Copier `.env.example` en `.env` (local) ou les déclarer dans EAS (`eas env:create`). Côté serveur : `GOOGLE_CLIENT_IDS`,
`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, puis appliquer la migration `20261031120000_oauth_accounts` (voir la doc serveur).

### 4. Nouveau build natif
Les deux SDK sont natifs : `eas build --profile development --platform android` (Expo Go ne les contient pas).

## Limites connues
- iOS / Facebook : sans l'autorisation de suivi (ATT), Facebook renvoie un jeton « Limited Login » et non un jeton d'accès ;
  le serveur ne sait lire que le jeton d'accès. Android n'est pas concerné.
- Aucune session Google ou Facebook n'est gardée sur l'appareil (déconnexion locale juste après l'obtention du jeton) : la
  session est celle d'EduLoc.
