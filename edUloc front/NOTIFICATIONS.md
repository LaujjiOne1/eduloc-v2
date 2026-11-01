# Notifications Android natives (edUloc)

## Ce qui marche sans rien configurer
- **Rappels de cours locaux** (`src/lib/lesson-reminders.ts`) : alarmes programmées sur l'appareil, à l'heure du paramètre « Alarme de cours »,
  sans internet, application fermée, avec l'icône (`assets/images/notification-icon.png`) et la couleur edUloc. Il faut **un nouveau build**
  (le plugin `expo-notifications` d'`app.json` a changé) et la permission de notification accordée.

## Ce qui exige une configuration hors code (push depuis le serveur : appels, nouveaux messages, rappels si l'app n'a pas été ouverte)
1. ✅ FAIT (2026-10-30) : `eas init --account laujjione` → projet `@laujjione/edUloc`, `extra.eas.projectId` ajouté à `app.json`.
2. À FAIRE : console Firebase → créer un projet → ajouter une application Android de package `mg.eduloc.app` → télécharger `google-services.json` à la racine de `eduloc front`, puis ajouter `"googleServicesFile": "./google-services.json"` dans `android` d'`app.json`.
3. À FAIRE : Firebase → Paramètres du projet → Comptes de service → « Générer une nouvelle clé privée » (JSON), puis expo.dev → projet edUloc → Credentials → Android → FCM V1 service account key (ou `eas credentials`).
4. À FAIRE APRÈS 2 et 3 : `eas build --profile development --platform android` (sans `google-services.json` le build ne pourrait pas créer de jeton push).
5. Serveur : `EXPO_ACCESS_TOKEN` (facultatif) ; les jetons Expo sont enregistrés par `POST /devices`.

## Canaux Android créés par l'application
`default`, `reminders` (vibration marquée), `messages`, `calls_ring` (priorité max, sonnerie ≈ 36 s, vibration en boucle). L'ancien canal `calls`
est supprimé. Le serveur choisit le canal dans `outbox-relay.service.ts`.

## Limites connues
- Un appel entrant, application fermée, s'affiche en notification prioritaire (bandeau + sonnerie longue + vibration) ; l'écran d'appel plein écran
  façon Messenger sur écran verrouillé demande un module natif dédié (ex. Notifee `fullScreenAction`) : non inclus.
- Android 14+ : les alarmes exactes demandent que l'utilisateur autorise « Alarmes et rappels » dans les réglages ; sinon le rappel local
  peut arriver avec quelques minutes d'écart.
