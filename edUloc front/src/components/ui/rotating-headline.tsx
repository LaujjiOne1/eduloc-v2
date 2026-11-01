import { useFocusEffect } from "expo-router";
import { type ComponentType, useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from "react-native-reanimated";

import type { IconProps } from "@/components/icons";

export type HeadlineItem = {
  key: string;
  Icon: ComponentType<IconProps>;
  text: string;
};

type RotatingHeadlineProps = {
  items: HeadlineItem[];
  /** Durée d'affichage de chaque phrase. */
  intervalMs?: number;
};

/** Violet accent de la charte : lisible en gros caractères sur le fond sombre du bandeau. */
const VIOLET = "#8D7FE3";
const ROW_HEIGHT = 40;

/**
 * Fin de phrase qui change en boucle, avec son icône : « Trouvez le bon tuteur … près de chez vous / en visio / en salle
 * d'étude / validé et de confiance / du primaire au doctorat ». La phrase sortante part vers le haut pendant que la suivante
 * monte d'en bas ; sans animation (« réduire les animations »), elles se remplacent simplement. Suspendu hors écran.
 */
export function RotatingHeadline({ items, intervalMs = 3200 }: RotatingHeadlineProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!focused || items.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(timer);
  }, [focused, items.length, intervalMs]);

  const item = items[index % items.length];
  if (!item) return null;
  const { Icon } = item;

  return (
    <View style={{ height: ROW_HEIGHT, overflow: "hidden" }} accessibilityLiveRegion="polite">
      {/* Style et non className : les composants animés ne reçoivent pas les classes Tailwind (voir FadeIn, ExpandableCard). */}
      <Animated.View
        key={item.key}
        entering={reduced ? undefined : FadeInDown.duration(420)}
        exiting={reduced ? undefined : FadeOutUp.duration(260)}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 11, height: 34, justifyContent: "center", width: 34 }}>
          <Icon size={19} color="#FFFFFF" />
        </View>
        <Text className="flex-1 text-[20px] font-bold font-display" style={{ color: VIOLET }} numberOfLines={1}>
          {item.text}
        </Text>
      </Animated.View>
    </View>
  );
}
