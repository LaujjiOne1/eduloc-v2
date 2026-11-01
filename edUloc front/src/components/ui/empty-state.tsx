import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Illustration, type IllustrationName } from "@/components/ui/illustrations";

type EmptyStateProps = {
  illustration: IllustrationName;
  title: string;
  message?: string;
  /** Action proposée pour sortir de l'impasse (modifier la recherche, créer un créneau…). */
  actionLabel?: string;
  onAction?: () => void;
  /** Version resserrée pour un état vide à l'intérieur d'un bloc (créneaux d'un jour, par ex.). */
  compact?: boolean;
};

/** État vide scénarisé : une illustration, un titre bienveillant, une phrase d'aide et, si possible, un bouton. */
export function EmptyState({ illustration, title, message, actionLabel, onAction, compact }: EmptyStateProps) {
  return (
    <View className={["items-center px-6", compact ? "py-6" : "py-10"].join(" ")}>
      <Illustration name={illustration} size={compact ? 104 : 132} />
      <Text className="mt-4 text-center text-[18px] font-bold font-display text-ink">{title}</Text>
      {message ? <Text className="mt-1.5 max-w-[290px] text-center text-[14px] leading-[20px] text-ink-soft">{message}</Text> : null}
      {actionLabel && onAction ? (
        <View className="mt-5 self-stretch">
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
