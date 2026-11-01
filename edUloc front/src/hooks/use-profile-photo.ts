import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

import { ApiError } from "@/api/errors";
import { describeLocalFile } from "@/api/upload";
import { t } from "@/i18n";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, AvatarService } from "@/services/avatar.service";
import { useAuthStore } from "@/store/auth.store";

export type PhotoSource = "library" | "camera";
type Busy = "upload" | "remove" | null;

/** Type déduit de l'extension quand le sélecteur n'annonce rien (le recadrage produit le plus souvent un JPEG). */
function guessMime(uri: string): string {
  const extension = uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Changer ou retirer sa photo de profil : choix dans la photothèque ou prise de vue, recadrage carré, envoi, puis mise à
 * jour de l'utilisateur connecté (l'avatar change partout à l'écran sans recharger).
 */
export function useProfilePhoto() {
  const avatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const applyAvatar = (url: string | null) => {
    const current = useAuthStore.getState().user;
    if (current) useAuthStore.getState().setUser({ ...current, avatarUrl: url });
  };

  const pick = useCallback(
    async (source: PhotoSource) => {
      if (busy) return;
      setError(null);
      try {
        if (source === "camera") {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) return setError(t("hooks.profilePhoto.cameraAccessDenied"));
        }
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
        const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        const mimeType = (asset.mimeType ?? guessMime(asset.uri)).toLowerCase();
        if (!(AVATAR_MIME_TYPES as readonly string[]).includes(mimeType)) return setError(t("hooks.profilePhoto.unsupportedFormat"));
        const sizeBytes = asset.fileSize ?? (await describeLocalFile(asset.uri, mimeType)).sizeBytes;
        if (sizeBytes <= 0 || sizeBytes > AVATAR_MAX_BYTES) return setError(t("hooks.profilePhoto.tooLarge"));

        setBusy("upload");
        applyAvatar(await AvatarService.upload({ uri: asset.uri, mimeType, sizeBytes, fileName: asset.fileName ?? undefined }));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t("hooks.profilePhoto.uploadFailed"));
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );

  const remove = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy("remove");
    try {
      await AvatarService.remove();
      applyAvatar(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("hooks.profilePhoto.removeFailed"));
    } finally {
      setBusy(null);
    }
  }, [busy]);

  return { avatarUrl, busy, error, pick, remove, clearError: () => setError(null) };
}
