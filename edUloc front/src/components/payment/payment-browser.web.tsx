import { Linking, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { LockIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { Button } from "@/components/ui/button";

type PaymentBrowserProps = {
  url: string;
  onDone: () => void;
  onClose: () => void;
};

/**
 * Version web : pas de WebView dans un navigateur. La page de paiement s'ouvre dans un nouvel onglet et l'utilisateur revient
 * ici pour que le statut soit relu auprès du backend (le retour d'un onglet ne prouve rien non plus).
 */
export function PaymentBrowser({ url, onDone, onClose }: PaymentBrowserProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-line-soft px-4 pb-3 pt-2.5">
        <PressableScale onPress={onClose} accessibilityLabel={t("payment.close")}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-paper-alt">
            <XIcon size={17} color="#14162B" />
          </View>
        </PressableScale>
        <View className="min-w-0 flex-1">
          <Text className="text-[14.5px] font-bold text-ink">{t("payment.title")}</Text>
          <View className="flex-row items-center gap-1">
            <LockIcon size={11} color="#0E9C82" />
            <Text className="text-[12px] text-ink-soft" numberOfLines={1}>{host}</Text>
          </View>
        </View>
      </View>

      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Text className="text-center text-[13.5px] leading-[20px] text-ink-soft">{t("payment.webHint")}</Text>
        <View className="self-stretch gap-3">
          <Button label={t("payment.openInBrowser")} onPress={() => void Linking.openURL(url)} fullWidth />
          <Button label={t("payment.finishedHint")} variant="ghost" onPress={onDone} fullWidth />
        </View>
      </View>
    </View>
  );
}
