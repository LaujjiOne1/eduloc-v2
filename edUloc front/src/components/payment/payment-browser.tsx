import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { useTranslation } from "react-i18next";

import { LockIcon, RefreshIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";

type PaymentBrowserProps = {
  /** Page du service de paiement (le ticket signé est dans son fragment). */
  url: string;
  /** La page annonce qu'elle a fini (retour `eduloc://payment/return` ou message) : on relit alors le statut auprès du backend. */
  onDone: () => void;
  /** L'utilisateur ferme la page : il a peut-être déjà confirmé son paiement, on vérifie aussi. */
  onClose: () => void;
};

const RETURN_PREFIX = "eduloc://payment/return";
const DONE_MESSAGE = "eduloc:payment:done";

/** Origine (schéma + hôte + port) d'une adresse, ou null. */
function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Page de paiement affichée DANS l'application, comme le navigateur intégré de Facebook : barre du haut avec fermeture, titre,
 * cadenas et nom de domaine (toujours visible : on voit où l'on paie), actualisation, barre de progression.
 *
 * Sécurité : navigation limitée au HTTPS (HTTP en développement seulement), jamais d'ouverture automatique d'un autre schéma,
 * pas de cookies ni de cache conservés, une seule fenêtre. Le retour ou un message de la page ne prouvent RIEN : ils déclenchent
 * seulement la relecture du statut auprès du backend (SEC-06).
 */
export function PaymentBrowser({ url, onDone, onClose }: PaymentBrowserProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const checkoutOrigin = originOf(url);
  const [pageTitle, setPageTitle] = useState("");
  const [currentUrl, setCurrentUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const progress = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%`, opacity: progress.get() >= 1 ? 0 : 1 }));

  // Bouton retour d'Android : recule dans la page de paiement, sinon ferme (et vérifie).
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) webRef.current?.goBack();
      else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack, onClose]);

  const allowRequest = useCallback((request: { url: string }) => {
    if (request.url.startsWith(RETURN_PREFIX)) {
      onDone();
      return false;
    }
    if (request.url.startsWith("about:")) return true;
    const secure = request.url.startsWith("https://") || (__DEV__ && request.url.startsWith("http://"));
    return secure; // tout autre schéma (intent:, tel:, javascript:, file:…) est refusé
  }, [onDone]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // Seule la page de paiement elle-même peut annoncer sa fin ; un contenu tiers (cadre 3-D Secure) est ignoré.
      if (originOf(event.nativeEvent.url) !== checkoutOrigin) return;
      try {
        const message = JSON.parse(event.nativeEvent.data) as { type?: string };
        if (message.type === DONE_MESSAGE) onDone();
      } catch {
        // message illisible : ignoré
      }
    },
    [checkoutOrigin, onDone],
  );

  const onNavigation = (state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
    setCurrentUrl(state.url);
    if (state.title && !state.title.startsWith("http")) setPageTitle(state.title);
  };

  const host = originOf(currentUrl)?.replace(/^https?:\/\//, "") ?? "";
  const secure = currentUrl.startsWith("https://");

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      {/* Barre façon navigateur intégré */}
      <View className="flex-row items-center gap-3 border-b border-line-soft bg-surface px-4 pb-3 pt-2.5">
        <PressableScale onPress={onClose} accessibilityLabel={t("payment.close")}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-paper-alt">
            <XIcon size={17} color="#14162B" />
          </View>
        </PressableScale>

        <View className="min-w-0 flex-1">
          <Text className="text-[14.5px] font-bold text-ink" numberOfLines={1}>
            {pageTitle || t("payment.title")}
          </Text>
          <View className="flex-row items-center gap-1" accessibilityLabel={secure ? t("payment.secureConnection") : undefined}>
            <LockIcon size={11} color={secure ? "#0E9C82" : "#9799AF"} />
            <Text className="flex-1 text-[12px] text-ink-soft" numberOfLines={1}>
              {host}
            </Text>
          </View>
        </View>

        <PressableScale onPress={() => webRef.current?.reload()} accessibilityLabel={t("payment.reload")}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-paper-alt">
            <RefreshIcon size={17} color="#14162B" />
          </View>
        </PressableScale>
      </View>
      <View className="h-[2.5px] bg-line-soft">
        <Animated.View style={[{ height: 2.5, backgroundColor: "#332E86" }, barStyle]} />
      </View>

      <View className="flex-1">
        {failed ? (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center text-[16px] font-bold font-display text-ink">{t("payment.pageError")}</Text>
            <Text className="text-center text-[13.5px] text-ink-soft">{t("payment.pageErrorHint")}</Text>
            <View className="self-stretch">
              <Button
                label={t("payment.reload")}
                onPress={() => {
                  setFailed(false);
                  setLoading(true);
                  webRef.current?.reload();
                }}
                fullWidth
              />
            </View>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: url }}
            style={{ flex: 1, backgroundColor: "#FFFFFF" }}
            originWhitelist={__DEV__ ? ["https://*", "http://*"] : ["https://*"]}
            onShouldStartLoadWithRequest={allowRequest}
            onNavigationStateChange={onNavigation}
            onMessage={onMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onLoadProgress={(event) => progress.set(withTiming(event.nativeEvent.progress, { duration: 120 }))}
            onError={() => setFailed(true)}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode >= 500) setFailed(true);
            }}
            javaScriptEnabled
            domStorageEnabled
            // Pas de cookie ni de cache conservés d'un paiement à l'autre ; une seule fenêtre ; pas d'accès aux fichiers.
            incognito
            cacheEnabled={false}
            sharedCookiesEnabled={false}
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            allowsLinkPreview={false}
            geolocationEnabled={false}
            mixedContentMode="never"
            // Les pages de banque (3-D Secure) ont besoin de cookies tiers pour leur défi.
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures
          />
        )}

        {loading && !failed ? (
          <View className="absolute inset-0 items-center justify-center bg-surface/70" pointerEvents="none">
            <ActivityIndicator color="#332E86" />
            <Text className="mt-2 text-[13px] text-ink-soft">{t("payment.loading")}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
