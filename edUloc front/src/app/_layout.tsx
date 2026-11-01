import "../global.css";
import "@/i18n";
import "@/store/language.store";

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { toAuthenticatedUser } from "@/api/mappers";
import { Session } from "@/api/session";
import { asyncStorageSession } from "@/api/session-storage";
import { SignOutPrompt } from "@/components/ui/sign-out-prompt";
import { SwitchAccountSheet } from "@/components/ui/switch-account-sheet";
import { registerNativeSocialAuth } from "@/lib/social-auth-native";
import { RealtimeProvider } from "@/realtime/realtime-provider";
import { AuthService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { Fragment, type ReactNode, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";

// Démarré à l'import (avant le premier rendu d'un écran) : les requêtes authentifiées attendent
// Session.whenReady(). Le rendu serveur d'Expo Router (export web) n'a pas de `window` : on s'abstient.
if (typeof window !== "undefined") {
  Session.setStorage(asyncStorageSession);
  registerNativeSocialAuth();
  void AuthService.restoreSession()
    .then((user) => {
      if (user) useAuthStore.getState().setUser(user);
    })
    .catch(() => undefined); // hors ligne : on garde l'utilisateur persisté
}

/** Session → store : un profil rafraîchi met le store à jour ; une session perdue déconnecte l'UI. */
Session.subscribe((me) => {
  const store = useAuthStore.getState();
  if (me) store.setUser(toAuthenticatedUser(me));
  else store.sessionLost();
});

/**
 * Remonte le contenu des écrans quand la langue change : les libellés calculés à la volée (dates, distances, états) sont
 * recalculés et les données rechargées dans la nouvelle langue. La pile de navigation, elle, n'est pas touchée.
 */
function LanguageBoundary({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  // Le compte actif entre aussi dans la clé : un changement de compte sans déconnexion repart d'un écran vierge.
  const accountEpoch = useAuthStore((s) => s.accountEpoch);
  return <Fragment key={`${language}:${accountEpoch}`}>{children}</Fragment>;
}

// Le splash natif (fond #211C5E, le « primaire foncé » de la charte, sans image) reste affiché jusqu'au chargement des polices : pas d'écran blanc, puis le
// splash animé de l'accueil prend le relais sur la même couleur.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// L'écran de départ est toujours l'accueil (« / »), quelle que soit la façon dont les écrans sont déclarés plus bas.
export const unstable_settings = { initialRouteName: "index" };

export default function RootLayout() {
  // Space Grotesk (titres, logo) et Inter (corps, interface) : on attend leur chargement pour ne pas afficher une police de secours puis la remplacer.
  const [fontsLoaded, fontsError] = useFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const fontsReady = fontsLoaded || !!fontsError;
  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RealtimeProvider>
          {/* freezeOnBlur : un écran recouvert ne se re-rend plus tant qu'il n'est pas revenu au premier plan. */}
          <Stack
            screenOptions={{ headerShown: false, freezeOnBlur: true }}
            screenLayout={({ children }) => <LanguageBoundary>{children}</LanguageBoundary>}
          >
            {/* « index » d'abord : le premier écran déclaré est celui où l'application démarre. */}
            <Stack.Screen name="index" />
            {/* La recherche monte du bas comme une feuille (façon Airbnb) au lieu de glisser de côté. */}
            {/* Le paiement monte du bas, sans retour par balayage : on ne l'abandonne pas par accident en plein règlement. */}
            <Stack.Screen name="payment/index" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
            <Stack.Screen
              name="search/index"
              // Fenêtre transparente : l'écran d'origine reste visible derrière le verre dépoli de la recherche.
              options={{ animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
          </Stack>
          <SignOutPrompt />
          <SwitchAccountSheet />
        </RealtimeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
