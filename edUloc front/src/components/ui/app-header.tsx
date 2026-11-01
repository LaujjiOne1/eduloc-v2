import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "@/components/ui/glass-surface";

/** Hauteur de la barre sans la zone sûre : logo 32 px + marges. Sert d'estimation avant la première mesure. */
export const APP_HEADER_BASE_HEIGHT = 64;

type AppHeaderProps = {
  /** Hauteur totale mesurée (zone sûre comprise) : le contenu défilant s'y cale pour démarrer juste dessous. */
  onHeight: (height: number) => void;
  children: ReactNode;
};

/**
 * Barre du haut (logo, rôle, cloche) façon en-tête de la page d'accueil web : collée en haut, fond de la page rendu translucide à
 * 85 % sur un flou, liseré fin dessous. Le contenu défile SOUS elle et se devine à travers le verre. Elle recouvre aussi la zone
 * de la barre d'état. Sans flou natif disponible (ancien build), le fond est presque opaque : la lecture reste nette.
 */
export function AppHeader({ onHeight, children }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}
      onLayout={(event) => onHeight(Math.round(event.nativeEvent.layout.height))}
    >
      <GlassSurface
        tint="rgba(248,250,252,0.85)"
        fallbackTint="rgba(248,250,252,0.96)"
        intensity={60}
        style={{ borderBottomWidth: 1, borderBottomColor: "rgba(226,232,240,0.9)" }}
      >
        <View className="flex-row items-center justify-between px-5 pb-3 pt-4" style={{ paddingTop: insets.top + 16 }}>
          {children}
        </View>
      </GlassSurface>
    </View>
  );
}
