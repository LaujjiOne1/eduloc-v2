import { useCallback } from "react";

import { useLoadEffect } from "@/hooks/use-load-effect";
import { useRealtimeReload } from "@/realtime/use-realtime-event";
import { ConversationService } from "@/services/conversation.service";
import { useMessageBadgeStore } from "@/store/message-badge.store";

/**
 * Total des messages non lus pour la pastille de l'onglet Messages. Relu à l'ouverture de la barre et à chaque événement
 * de message ; la liste des conversations met aussi le compteur à jour quand elle se charge. Un échec réseau garde la
 * dernière valeur connue.
 */
export function useUnreadMessages(): number {
  const unread = useMessageBadgeStore((s) => s.unread);
  const setUnread = useMessageBadgeStore((s) => s.setUnread);

  const load = useCallback(async () => {
    try {
      const conversations = await ConversationService.getConversations();
      setUnread(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
    } catch {
      // hors ligne : on garde la valeur précédente
    }
  }, [setUnread]);

  useLoadEffect(load);
  useRealtimeReload(() => void load(), ["message."]);

  return unread;
}
