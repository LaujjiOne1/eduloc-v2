import { Text, View } from "react-native";

import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

type ResultsLoginGateProps = {
  /** Nombre de tuteurs trouvés (toujours au moins 1 : sans résultat, la garde ne s'affiche pas). */
  count: number;
  onLogin: () => void;
  onSignup: () => void;
};

/**
 * Visiteur non connecté, recherche fructueuse : on annonce SEULEMENT combien de tuteurs ont été trouvés (ni noms, ni photos, ni
 * silhouettes, ni tarifs) et on propose de se connecter pour tous les voir.
 */
export function ResultsLoginGate({ count, onLogin, onSignup }: ResultsLoginGateProps) {
  const { t } = useTranslation();
  return (
    <FadeIn delay={80}>
      <View className="mx-5 mt-2 items-center rounded-2xl border border-line bg-surface shadow-card px-5 py-8">
        <Text className="text-center text-[56px] font-bold font-display leading-[60px] text-primary">{count}</Text>
        <Text className="mt-1 text-center text-[18px] font-bold font-display text-ink">
          {t("ui.resultsLoginGate.tutorsAvailableNearYou", { count })}
        </Text>
        <Text className="mt-2 max-w-[300px] text-center text-[13.5px] leading-[20px] text-ink-soft">
          {t("ui.resultsLoginGate.signInToSeeThe")}</Text>

        <View className="mt-6 w-full gap-3">
          <Button label={t("common.signIn")} onPress={onLogin} />
          <Button label={t("common.createAnAccount")} variant="secondary" onPress={onSignup} />
        </View>
      </View>
    </FadeIn>
  );
}
