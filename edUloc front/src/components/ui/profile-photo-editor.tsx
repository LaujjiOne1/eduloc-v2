import { useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CameraIcon, ImageIcon, TrashIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import { useProfilePhoto } from "@/hooks/use-profile-photo";
import type { TutorGender } from "@/types/common";

type ProfilePhotoEditorProps = {
  /** Nom complet : sans photo, l'avatar affiche ses initiales. */
  name: string;
  gender?: TutorGender | null;
  /** Photo déjà connue d'ailleurs (fiche tuteur) tant que le compte n'a pas la sienne. */
  fallbackUrl?: string | null;
  size?: number;
};

type ActionRowProps = { icon: React.ReactNode; label: string; onPress: () => void; destructive?: boolean };

function ActionRow({ icon, label, onPress, destructive }: ActionRowProps) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View className="flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4 py-[14px]">
        {icon}
        <Text className={["text-[14.5px] font-semibold", destructive ? "text-error" : "text-ink"].join(" ")}>{label}</Text>
      </View>
    </PressableScale>
  );
}

/**
 * Photo de profil modifiable, pour tous les types de compte : l'avatar (photo ou initiales) avec un badge appareil photo ;
 * un toucher ouvre la feuille « prendre une photo / choisir dans la photothèque / supprimer ». L'envoi, le recadrage carré
 * et les erreurs sont gérés par `useProfilePhoto`.
 */
export function ProfilePhotoEditor({ name, gender, fallbackUrl, size = 72 }: ProfilePhotoEditorProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { avatarUrl, busy, error, pick, remove, clearError } = useProfilePhoto();
  const [sheetOpen, setSheetOpen] = useState(false);
  const photoUrl = avatarUrl ?? fallbackUrl ?? null;

  const choose = (action: () => Promise<void>) => {
    setSheetOpen(false);
    void action();
  };

  return (
    <View className="items-center">
      <PressableScale
        onPress={() => {
          clearError();
          setSheetOpen(true);
        }}
        disabled={busy !== null}
        accessibilityLabel={photoUrl ? t("ui.profilePhotoEditor.changePhoto") : t("ui.profilePhotoEditor.addPhoto")}
      >
        <View style={{ width: size, height: size }}>
          <TutorAvatar gender={gender} photoUrl={photoUrl} name={name} size={size} />
          {busy ? (
            <View
              className="items-center justify-center bg-black/40"
              style={{ position: "absolute", top: 0, left: 0, width: size, height: size, borderRadius: size / 2 }}
              accessibilityLabel={busy === "upload" ? t("ui.profilePhotoEditor.uploading") : t("ui.profilePhotoEditor.removing")}
            >
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
          <View
            className="items-center justify-center rounded-full border-2 border-surface bg-primary"
            style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26 }}
          >
            <CameraIcon size={13} color="#fff" />
          </View>
        </View>
      </PressableScale>
      {error ? <Text className="mt-2 max-w-[220px] text-center text-[12px] leading-[16px] text-error">{error}</Text> : null}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-2xl bg-surface p-5" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-[18px] font-bold font-display text-ink">{t("ui.profilePhotoEditor.title")}</Text>
              <PressableScale onPress={() => setSheetOpen(false)} accessibilityLabel={t("common.close")}>
                <View className="h-8 w-8 items-center justify-center rounded-full bg-paper">
                  <XIcon size={16} color="#585B78" />
                </View>
              </PressableScale>
            </View>
            <Text className="mb-4 text-[13px] leading-[19px] text-ink-soft">{t("ui.profilePhotoEditor.subtitle")}</Text>
            <View className="gap-[10px]">
              <ActionRow icon={<CameraIcon size={18} color="#332E86" />} label={t("ui.profilePhotoEditor.takePhoto")} onPress={() => choose(() => pick("camera"))} />
              <ActionRow icon={<ImageIcon size={18} color="#332E86" />} label={t("ui.profilePhotoEditor.chooseFromLibrary")} onPress={() => choose(() => pick("library"))} />
              {avatarUrl ? (
                <ActionRow icon={<TrashIcon size={18} color="#AC4A40" />} label={t("ui.profilePhotoEditor.removePhoto")} onPress={() => choose(remove)} destructive />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
