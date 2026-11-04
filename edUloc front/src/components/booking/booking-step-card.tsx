import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";

type BookingStepCardProps = {
  /** Question posée quand l'étape est ouverte (« Où souhaitez-vous le cours ? »). */
  title: string;
  /** Intitulé court affiché à gauche quand l'étape est repliée (« Lieu du cours »). */
  label: string;
  /** Choix déjà fait, affiché à droite quand l'étape est repliée ; sinon l'invite (« Ajouter une date »). */
  summary: string;
  /** Un choix a été fait : le résumé est mis en valeur. */
  done: boolean;
  open: boolean;
  /** Étape pas encore atteignable (l'étape précédente n'est pas terminée) : non cliquable, atténuée. */
  disabled?: boolean;
  onOpen: () => void;
  children: ReactNode;
};

/**
 * Carte d'une étape de réservation, façon « recherche Airbnb » : une seule carte est dépliée à la fois, les autres
 * se replient en une ligne « intitulé — choix » qu'on touche pour revenir modifier.
 */
export function BookingStepCard({ title, label, summary, done, open, disabled, onOpen, children }: BookingStepCardProps) {
  if (open) {
    return (
      <View className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <Text className="mb-4 text-[22px] font-bold font-display text-ink">{title}</Text>
        {children}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onOpen}
      disabled={disabled}
      accessibilityLabel={`${label} : ${summary}`}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View
        className={[
          "flex-row items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        <Text className="text-[14px] font-semibold text-ink-soft">{label}</Text>
        <View className="flex-1 flex-row items-center justify-end gap-2">
          <Text
            className={["flex-shrink text-right text-[14px]", done ? "font-bold text-ink" : "font-semibold text-ink-soft"].join(" ")}
            numberOfLines={1}
          >
            {summary}
          </Text>
          {done ? <ChevronRightIcon size={15} color="#9799AF" /> : null}
        </View>
      </View>
    </PressableScale>
  );
}
