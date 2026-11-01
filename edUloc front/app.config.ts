import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Configuration dynamique : part d'`app.json` et y ajoute les modules de connexion sociale AVEC les clés de l'environnement.
 * Pourquoi ici et pas dans `app.json` :
 *  - le plugin Facebook REFUSE de s'exécuter sans identifiant d'application (« missing appID ») : un `app.json` qui le déclare
 *    sans option casse tout build tant que l'application Meta n'existe pas ;
 *  - le plugin Google (variante sans Firebase) exige le schéma d'URL iOS, inutile sur Android.
 *
 * Variables (fichier `.env` local, ou variables d'environnement EAS) :
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID    client OAuth « Web » (sert aussi au serveur : GOOGLE_CLIENT_IDS)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    client OAuth iOS (facultatif : Android seul n'en a pas besoin)
 *   EXPO_PUBLIC_FACEBOOK_APP_ID         identifiant de l'application Meta
 *   FACEBOOK_CLIENT_TOKEN               jeton client de l'application Meta (build seulement, hors du bundle)
 *
 * Sans clés, le build reste valable : Facebook reçoit un identifiant factice (le SDK s'initialise sans planter, la connexion
 * répond « pas encore disponible »), Google n'ajoute rien.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [...(config.plugins ?? [])];

  const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() || "000000000000000";
  plugins.push([
    "react-native-fbsdk-next",
    {
      appID: facebookAppId,
      clientToken: process.env.FACEBOOK_CLIENT_TOKEN?.trim() || "00000000000000000000000000000000",
      displayName: "EduLoc",
      scheme: `fb${facebookAppId}`,
      // Ni collecte de l'identifiant publicitaire ni journal d'événements automatique : on n'utilise que la connexion.
      advertiserIDCollectionEnabled: false,
      autoLogAppEventsEnabled: false,
      isAutoInitEnabled: false,
    },
  ]);

  // « 1234-abc.apps.googleusercontent.com » → schéma d'URL iOS « com.googleusercontent.apps.1234-abc ».
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (googleIosClientId) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}` },
    ]);
  }

  return { ...config, plugins } as ExpoConfig;
};
