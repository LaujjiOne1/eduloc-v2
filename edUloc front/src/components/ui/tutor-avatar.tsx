import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { Circle, Path, Svg } from "react-native-svg";

import { rebaseLocalhost } from "@/api/config";
import type { TutorGender } from "@/types/common";

type TutorAvatarProps = {
  gender?: TutorGender | null;
  /** Photo de profil : prioritaire sur tout le reste. */
  photoUrl?: string | null;
  /** Nom complet : sans photo, l'avatar affiche ses initiales sur un dégradé pastel plutôt qu'une silhouette anonyme. */
  name?: string | null;
  size?: number;
  /** « full » : rond ; sinon rayon en pixels (carte de résultat : 12). */
  radius?: number | "full";
  accessibilityLabel?: string;
};

type Palette = { bg: string; body: string; hair: string };

/** Dégradés pastel des initiales : la teinte vient du nom, donc reste la même d'un écran à l'autre. */
const INITIALS_GRADIENTS: readonly { colors: readonly [string, string]; text: string }[] = [
  { colors: ["#ECEAF9", "#C9C2F2"], text: "#332E86" },
  { colors: ["#E1F5EF", "#AEE6D6"], text: "#0B7A66" },
  { colors: ["#FEF3DC", "#F9D79A"], text: "#9A5F06" },
  { colors: ["#F3F0FC", "#DCCFF7"], text: "#5B4BC4" },
  { colors: ["#FCE8E4", "#F5C3BB"], text: "#9A3A30" },
];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

function gradientFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return INITIALS_GRADIENTS[hash % INITIALS_GRADIENTS.length];
}

/** Couleurs EduLoc : violet profond pour l'homme, violet clair pour la femme, gris chaud sans information. */
const PALETTES: Record<TutorGender | "unknown", Palette> = {
  male: { bg: "#E6E3F7", body: "#332E86", hair: "#1F1B5C" },
  female: { bg: "#F1ECFC", body: "#8D7FE3", hair: "#5B4BC4" },
  unknown: { bg: "#eef2f7", body: "#B4B6C8", hair: "#9799AF" },
};

/**
 * Avatar du tuteur : sa photo si elle existe ; sinon une silhouette (homme / femme, comme l'avatar par défaut d'un
 * réseau social) choisie d'après le sexe de son profil, et une silhouette neutre quand il n'est pas renseigné.
 * Jamais d'initiale : l'avatar se reconnaît d'un coup d'œil.
 */
export function TutorAvatar({ gender, photoUrl, name, size = 48, radius = "full", accessibilityLabel }: TutorAvatarProps) {
  const palette = PALETTES[gender ?? "unknown"];
  const borderRadius = radius === "full" ? size / 2 : radius;

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, borderRadius, overflow: "hidden", backgroundColor: palette.bg }}
    >
      {photoUrl ? (
        // En développement, le backend enregistre l'adresse en « localhost » (stockage local) : on la ramène à l'hôte de l'API,
        // seul joignable depuis un téléphone ou un émulateur.
        <Image source={{ uri: rebaseLocalhost(photoUrl) }} style={{ width: size, height: size }} contentFit="cover" />
      ) : name && initialsOf(name) ? (
        <LinearGradient
          colors={gradientFor(name).colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: gradientFor(name).text, fontSize: size * 0.36, fontWeight: "700", letterSpacing: 0.5 }}>{initialsOf(name)}</Text>
        </LinearGradient>
      ) : (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          {gender === "female" ? (
            // Cheveux longs derrière le visage et les épaules
            <Path d="M17 28 C17 13 24 8 32 8 C40 8 47 13 47 28 L49 46 C45 43 42 42 41 39 L23 39 C22 42 19 43 15 46 Z" fill={palette.hair} />
          ) : null}
          {/* Épaules */}
          <Path d="M8 66 C8 49 19 41 32 41 C45 41 56 49 56 66 Z" fill={palette.body} />
          {/* Cou + visage */}
          <Path d="M27 36 L37 36 L37 43 C35 45 29 45 27 43 Z" fill={palette.body} />
          <Circle cx="32" cy="26" r="11" fill={palette.body} />
          {gender === "male" ? (
            // Cheveux courts
            <Path d="M20.5 25 C20 15 26 12 32 12 C38 12 44 15 43.5 25 C41 20 37 19 32 19 C27 19 23 20 20.5 25 Z" fill={palette.hair} />
          ) : null}
          {gender === "female" ? (
            // Frange
            <Path d="M21 25 C22 17 27 14.5 32 14.5 C38 14.5 42 18 43 25 C40 22 36 20.5 31 21 C27 21.5 23.5 22.5 21 25 Z" fill={palette.hair} />
          ) : null}
        </Svg>
      )}
    </View>
  );
}
