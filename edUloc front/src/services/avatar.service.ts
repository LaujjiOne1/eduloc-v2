import { api } from "@/api/http";
import type { UploadTicketDto } from "@/api/contracts/dto";
import { uploadToSignedUrl } from "@/api/upload";
import type { LocalFile } from "@/types/message";

/** Types et poids acceptés par le serveur (UserAvatarService) : refuser ici évite un envoi voué à l'échec. */
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Photo de profil du compte connecté — la même pour un demandeur, un tuteur et un gestionnaire de lieu.
 * Routes backend : POST /users/me/avatar/upload-url → PUT direct vers le stockage → POST /users/me/avatar, DELETE /users/me/avatar.
 * Le serveur reste l'autorité : type, poids et propriétaire du ticket sont revérifiés à l'enregistrement.
 */
export const AvatarService = {
  /** Envoie le fichier et renvoie l'URL publique enregistrée sur le compte (et sur la fiche publique d'un tuteur). */
  async upload(file: LocalFile): Promise<string> {
    const ticket = await api.post<UploadTicketDto>("/users/me/avatar/upload-url", { mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    await uploadToSignedUrl(ticket, file);
    const result = await api.post<{ avatar: string }>("/users/me/avatar", { uploadId: ticket.uploadId });
    return result.avatar;
  },

  async remove(): Promise<void> {
    await api.delete("/users/me/avatar");
  },
};
