import { ApiError } from "@/api/errors";
import { t } from "@/i18n";
import { registerSocialAuthAdapter } from "@/lib/social-auth";

/**
 * Branche les SDK natifs de Google et de Facebook sur `lib/social-auth`. Un fournisseur n'est branché que si sa clé est
 * dans l'environnement (voir app.config.ts) : sans clé, son bouton répond « pas encore disponible ».
 *
 * Les modules natifs sont chargés à la demande (et pas à l'import) : un build qui ne les embarque pas encore (ancien
 * development build, Expo Go) ne plante pas, la connexion sociale est simplement indisponible.
 * Apple : volontairement non branché (programme développeur payant) ; le serveur sait déjà le vérifier.
 */

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim();

const unavailable = () => ApiError.local("provider_not_configured", t("services.authservice.thisSignInMethodIs"));
const failed = () => ApiError.local("server_error", t("common.anErrorOccurredPleaseTry"));

type GoogleModule = typeof import("@react-native-google-signin/google-signin");
type FacebookModule = typeof import("react-native-fbsdk-next");

function loadGoogle(): GoogleModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement tolérant à un module natif absent du build
    return require("@react-native-google-signin/google-signin") as GoogleModule;
  } catch {
    throw unavailable();
  }
}

function loadFacebook(): FacebookModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement tolérant à un module natif absent du build
    return require("react-native-fbsdk-next") as FacebookModule;
  } catch {
    throw unavailable();
  }
}

let googleConfigured = false;

/** Google : jeton d'identité (idToken) dont le destinataire est le client « Web » ; le serveur le vérifie (GOOGLE_CLIENT_IDS). */
async function googleCredential() {
  const { GoogleSignin, statusCodes, isErrorWithCode } = loadGoogle();
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined });
    googleConfigured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return null; // fenêtre fermée
    const token = response.data.idToken;
    if (!token) throw failed();
    // On ne garde rien côté Google : la session est celle d'EduLoc. Et le prochain essai propose de nouveau le choix du compte.
    void GoogleSignin.signOut().catch(() => undefined);
    return { token };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw failed();
  }
}

/** Facebook : jeton d'accès, que le serveur contrôle auprès de l'API Graph (il doit avoir été émis pour NOTRE application). */
async function facebookCredential() {
  const { LoginManager, AccessToken } = loadFacebook();
  try {
    const result = await LoginManager.logInWithPermissions(["public_profile", "email"]);
    if (result.isCancelled) return null;
    const access = await AccessToken.getCurrentAccessToken();
    if (!access?.accessToken) throw failed();
    // Même principe que Google : aucune session Facebook gardée sur l'appareil.
    LoginManager.logOut();
    return { token: access.accessToken };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw failed();
  }
}

/** À appeler une fois au démarrage (src/app/_layout.tsx). */
export function registerNativeSocialAuth(): void {
  if (GOOGLE_WEB_CLIENT_ID) registerSocialAuthAdapter("google", googleCredential);
  if (FACEBOOK_APP_ID) registerSocialAuthAdapter("facebook", facebookCredential);
}
