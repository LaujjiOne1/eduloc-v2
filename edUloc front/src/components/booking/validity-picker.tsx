import { View } from "react-native";

import { durationShortLabel } from "@/api/format/datetime";
import { Chip } from "@/components/ui/chip";

/** Durées de validité proposées (minutes). Le serveur borne et fait foi (BOOKING_REQUEST_VALIDITY_*_MINUTES). */
export const REQUEST_VALIDITY_CHOICES = [60, 360, 720, 1440, 2880];
export const DEFAULT_REQUEST_VALIDITY = 1440;

/** Choix retenu quand une valeur n'est plus proposée (cours trop proche) : la plus longue qui reste possible. */
export function pickValidity(current: number, choices: number[]): number {
  if (choices.includes(current)) return current;
  return choices[choices.length - 1] ?? current;
}

type ValidityPickerProps = {
  choices: number[];
  value: number;
  onChange: (minutes: number) => void;
};

/** « Combien de temps la demande reste-t-elle valable ? » — 1h, 6h, 12h, 24h, 48h. */
export function ValidityPicker({ choices, value, onChange }: ValidityPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {choices.map((minutes) => (
        <Chip key={minutes} label={durationShortLabel(minutes)} active={minutes === value} onPress={() => onChange(minutes)} />
      ))}
    </View>
  );
}
