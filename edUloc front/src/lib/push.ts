import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { api } from "@/api/http";
import { t } from "@/i18n";

type NotificationsModule = typeof import("expo-notifications");

/**
 * Notifications push natives (app fermée ou en arrière-plan), comme Messenger :
 *  - canal Android « calls » à priorité maximale pour les appels entrants (sonnerie, écran de verrouillage) ;
 *  - jeton Expo enregistré côté serveur (POST /devices), qui s'en sert pour les envois (voir ExpoPushProvider).
 *
 * Prérequis hors code : application compilée (EAS / dev build), `eas init` (projectId) et identifiants
 * FCM / APNs configurés dans EAS.
 *
 * Expo Go (Android, SDK 53+) : le module `expo-notifications` LÈVE UNE ERREUR dès son chargement. Il n'est donc
 * jamais importé statiquement : on le charge à la demande, uniquement hors Expo Go et hors web. Dans Expo Go, ce
 * fichier ne fait rien et l'app garde ses alertes en direct (temps réel, bandeau et sonnerie d'appel au premier plan).
 */
const isNative = Platform.OS === "ios" || Platform.OS === "android";
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cached: NotificationsModule | null | undefined;

/** Module de notifications, ou null (Expo Go, web) : les appelants dégradent sans rien casser. */
export function notificationsModule(): NotificationsModule | null {
  return notifications();
}

function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (!isNative || isExpoGo) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-notifications") as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

let registeredToken: string | null = null;

/** Premier plan : un appel entrant est déjà signalé par le bandeau + la sonnerie de l'app — pas de doublon système. */
export function configureForegroundPresentation(): void {
  const Notifications = notifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Un appel et un rappel de cours ont déjà leur bandeau + sonnerie dans l'app : pas de doublon système au premier plan.
      const type = notification.request.content.data?.type;
      const inApp = type === "call.incoming" || type === "booking.reminder";
      return {
        shouldShowBanner: !inApp,
        shouldShowList: !inApp,
        shouldPlaySound: !inApp,
        shouldSetBadge: false,
      };
    },
  });
}

/** Couleur de la marque : liseré et accent des notifications Android (voir aussi `color` du plugin dans app.json). */
const BRAND_COLOR = "#332E86";

/**
 * Canaux Android. Un canal est figé à sa création (son, importance) : pour changer un réglage il faut un NOUVEAU
 * identifiant, d'où `calls_ring` à la place de l'ancien `calls` (dont la sonnerie ne durait que 3 secondes).
 *  - default   : alertes de réservation, avis, etc. ;
 *  - reminders : rappels de cours, vibration marquée, visibles sur l'écran de verrouillage ;
 *  - messages  : vocaux et documents reçus ;
 *  - calls_ring: appel entrant, priorité maximale, sonnerie d'environ 36 s (comme un téléphone qui sonne), vibration en boucle.
 */
export async function ensureAndroidChannels(Notifications: NotificationsModule = notifications() as NotificationsModule): Promise<void> {
  if (Platform.OS !== "android" || !Notifications) return;
  const visible = Notifications.AndroidNotificationVisibility.PUBLIC;
  await Notifications.setNotificationChannelAsync("default", {
    name: t("common.notifications"),
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: BRAND_COLOR,
    lockscreenVisibility: visible,
  });
  await Notifications.setNotificationChannelAsync("reminders", {
    name: t("lib.push.lessonReminders"),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 200, 300, 200, 600],
    enableVibrate: true,
    lightColor: BRAND_COLOR,
    lockscreenVisibility: visible,
  });
  await Notifications.setNotificationChannelAsync("messages", {
    name: t("lib.push.messages"),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 150, 200],
    lightColor: BRAND_COLOR,
    lockscreenVisibility: visible,
  });
  await Notifications.setNotificationChannelAsync("calls_ring", {
    name: t("lib.push.incomingCalls"),
    importance: Notifications.AndroidImportance.MAX,
    sound: "ringtone-call.wav",
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    vibrationPattern: [0, 800, 1200, 800, 1200, 800, 1200, 800, 1200],
    enableVibrate: true,
    bypassDnd: false,
    lightColor: BRAND_COLOR,
    lockscreenVisibility: visible,
  });
  // Ancien canal d'appel (sonnerie de 3 s) : retiré pour ne pas rester dans les réglages du téléphone.
  await Notifications.deleteNotificationChannelAsync("calls").catch(() => undefined);
}

/** Demande la permission, crée les canaux et enregistre le jeton de l'appareil. Ne lève jamais. */
export async function registerForPush(): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    await ensureAndroidChannels(Notifications);
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      // Sans identifiant de projet EAS, aucun jeton push n'existe : seuls les rappels locaux (alarmes de l'appareil) fonctionnent.
      if (__DEV__) console.warn("[push] extra.eas.projectId absent (lancer `eas init`) : pas de notification serveur, rappels locaux seulement.");
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post("/devices", { token, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" });
    registeredToken = token;
  } catch {
    // simulateur, hors ligne, identifiants push absents : pas de push, le reste fonctionne.
  }
}

/** À la déconnexion : cet appareil ne doit plus recevoir les notifications de ce compte. */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  await api.post("/devices/unregister", { token }).catch(() => undefined);
}

/** Écoute le toucher d'une notification (app en arrière-plan ou fermée). */
export function onNotificationOpened(handler: (data: Record<string, unknown>) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data ?? {});
  });
  // Ouverture à froid : la notification qui a lancé l'app.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handler(response.notification.request.content.data ?? {});
    })
    .catch(() => undefined);
  return () => subscription.remove();
}
