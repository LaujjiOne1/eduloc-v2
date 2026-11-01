import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { GlassSurface } from "@/components/ui/glass-surface";
import { SearchFunnel } from "./search-funnel";

const HOME_ROUTE = "/home" as Href;

/**
 * Recherche en feuille qui monte du bas (route `/search`) : l'habillage seul, voile sombre et verre dépoli. Le contenu est
 * `SearchFunnel`, le même que dans les barres de recherche qui s'allongent sur place (accueil, espace demandeur).
 */
export function SearchSheetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cycle } = useLocalSearchParams<{ cycle?: string }>();

  const close = () => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE));

  return (
    <View className="flex-1">
      {/* Voile sombre léger : toucher l'écran d'origine, au-dessus de la feuille, la ferme. */}
      <Pressable
        onPress={close}
        accessibilityLabel={t("common.close")}
        style={{ height: insets.top + 28, backgroundColor: "rgba(20,22,43,0.28)" }}
      />
      {/* Feuille en verre dépoli : la couleur de fond actuelle (#F1F5F9), rendue translucide sur l'écran flouté derrière. */}
      <GlassSurface
        tint="rgba(241,245,249,0.66)"
        fallbackTint="rgba(241,245,249,0.97)"
        intensity={55}
        style={{ flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.85)" }}
      >
        <SearchFunnel cycle={cycle} onClose={close} footerPadding={Math.max(insets.bottom, 16)} />
      </GlassSurface>
    </View>
  );
}
