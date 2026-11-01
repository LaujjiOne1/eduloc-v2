import { type Href, useFocusEffect, useRouter } from "expo-router";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { relativeTimeLabel } from "@/api/format/datetime";
import { FileIcon, MicIcon, SearchIcon, XIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { PressableScale } from "@/components/motion/pressable-scale";
import { AuthHeader } from "@/components/ui/auth-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { TutorAvatar } from "@/components/ui/tutor-avatar";
import { useConversations } from "@/hooks/use-conversations";
import type { ConversationSummary } from "@/types/message";
import { useTranslation } from "react-i18next";

type Props = {
  emptyTitle: string;
  emptyBody: string;
  /** Bouton de l'état vide (ex. « Trouver un tuteur »). */
  emptyAction?: { label: string; route: Href };
  /** Route de la conversation d'une réservation. */
  routeFor: (bookingId: string) => Href;
  /** Menu bas de l'espace (demandeur ou tuteur). */
  nav: ReactNode;
};

type Filter = "all" | "unread";

/** Minuscules sans accents : « Hérý » se retrouve avec « hery ». */
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Dernière activité d'abord : la conversation qui reçoit un message remonte en tête. */
function byRecency(a: ConversationSummary, b: ConversationSummary): number {
  return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
}

/**
 * 28 / 63 — liste des conversations (une par interlocuteur), partagée par les deux espaces : recherche, filtre « non
 * lus », liste continue à séparateurs fins, aperçu enrichi (vocal, document), pastille de non-lus.
 */
export function ConversationsListView({ emptyTitle, emptyBody, emptyAction, routeFor, nav }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, retry, reload } = useConversations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Retour depuis une conversation : les compteurs de non-lus sont à jour.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const all = useMemo(() => (state.status === "success" ? [...state.conversations].sort(byRecency) : []), [state]);
  const unreadTotal = all.filter((c) => c.unreadCount > 0).length;
  const visible = useMemo(() => {
    const words = fold(query.trim()).split(/\s+/).filter(Boolean);
    return all.filter((c) => {
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (words.length === 0) return true;
      const haystack = fold(`${c.counterpartName} ${c.lastMessagePreview ?? ""}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [all, filter, query]);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <AuthHeader onBack={() => router.back()} />

      <View className="px-5 pb-3">
        <FadeIn delay={30}>
          <Text className="mb-3 text-[25px] font-bold font-display text-ink">{t("chat.conversationsListView.conversations")}</Text>

          {state.status === "success" ? (
            <>
              <View className="mb-3 flex-row items-center gap-[10px] rounded-full border border-line-soft bg-surface px-4 py-[11px] shadow-card">
                <SearchIcon size={16} color="#9799AF" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("chat.conversationsListView.searchPlaceholder")}
                  placeholderTextColor="#9799AF"
                  className="flex-1 p-0 text-[14.5px] text-ink"
                  accessibilityLabel={t("chat.conversationsListView.searchPlaceholder")}
                  returnKeyType="search"
                />
                {query ? (
                  <PressableScale onPress={() => setQuery("")} accessibilityLabel={t("chat.conversationsListView.clearSearch")}>
                    <XIcon size={15} color="#9799AF" />
                  </PressableScale>
                ) : null}
              </View>
              <View className="flex-row gap-2">
                <Chip label={t("chat.conversationsListView.filterAll")} active={filter === "all"} onPress={() => setFilter("all")} />
                <Chip
                  label={unreadTotal > 0 ? `${t("chat.conversationsListView.filterUnread")} (${unreadTotal})` : t("chat.conversationsListView.filterUnread")}
                  active={filter === "unread"}
                  onPress={() => setFilter("unread")}
                />
              </View>
            </>
          ) : null}
        </FadeIn>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom + 20, 30) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {state.status === "loading" ? (
          <View className="gap-3 pt-2">
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-[72px] rounded-2xl bg-line-soft" />
            ))}
          </View>
        ) : state.status === "error" ? (
          <FadeIn delay={40}>
            <View className="my-6 items-center rounded-2xl border border-line-soft bg-surface p-8 shadow-card">
              <Text className="mb-4 text-center text-[14px] text-error">{state.message}</Text>
              <Button label={t("common.tryAgain")} variant="ghost" onPress={retry} />
            </View>
          </FadeIn>
        ) : state.status === "empty" ? (
          <FadeIn delay={60}>
            <EmptyState
              illustration="chat"
              title={emptyTitle}
              message={emptyBody}
              actionLabel={emptyAction?.label}
              onAction={emptyAction ? () => router.push(emptyAction.route) : undefined}
            />
          </FadeIn>
        ) : visible.length === 0 ? (
          <EmptyState illustration="search" title={t("chat.conversationsListView.noMatchTitle")} message={t("chat.conversationsListView.noMatchBody")} compact />
        ) : (
          // Liste continue : un seul fond blanc, des séparateurs fins qui laissent l'avatar dégagé.
          <View className="overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-card">
            {visible.map((conversation, index) => (
              <Animated.View key={conversation.id} entering={FadeInUp.duration(320).delay(Math.min(index, 8) * 40)} layout={LinearTransition.springify().damping(20)}>
                <ConversationRow
                  conversation={conversation}
                  last={index === visible.length - 1}
                  onPress={() => conversation.bookingId && router.push(routeFor(conversation.bookingId))}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {nav}
    </View>
  );
}

/** Mini forme d'onde décorative d'un message vocal. */
const WAVE = [5, 9, 13, 8, 15, 10, 6, 12, 7];

function Preview({ conversation, unread }: { conversation: ConversationSummary; unread: boolean }) {
  const { t } = useTranslation();
  const text = conversation.lastMessagePreview ?? t("chat.conversationsListView.noMessages");
  const textClass = ["flex-1 text-[13px]", unread ? "font-semibold text-ink" : "text-ink-soft"].join(" ");

  if (conversation.lastMessageType === "voice") {
    return (
      <View className="flex-1 flex-row items-center gap-1.5">
        <MicIcon size={14} color="#0E9C82" />
        <View className="flex-row items-center gap-[2px]">
          {WAVE.map((height, i) => (
            <View key={i} className="w-[2.5px] rounded-full bg-accent" style={{ height, opacity: 0.4 + (i % 3) * 0.3 }} />
          ))}
        </View>
        <Text className={textClass} numberOfLines={1}>
          {text}
        </Text>
      </View>
    );
  }
  if (conversation.lastMessageType === "document") {
    return (
      <View className="flex-1 flex-row items-center gap-1.5">
        <FileIcon size={14} color="#D4890A" />
        <Text className={textClass} numberOfLines={1}>
          {text}
        </Text>
      </View>
    );
  }
  return (
    <Text className={textClass} numberOfLines={1}>
      {text}
    </Text>
  );
}

function ConversationRow({ conversation, last, onPress }: { conversation: ConversationSummary; last: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const unread = conversation.unreadCount;
  return (
    <PressableScale
      onPress={onPress}
      disabled={!conversation.bookingId}
      accessibilityLabel={unread ? t("chat.conversationsListView.conversationWithUnread", { name: conversation.counterpartName, count: unread }) : t("chat.conversationsListView.conversationWith", { name: conversation.counterpartName })}
    >
      <View className="flex-row items-center gap-3.5 px-4 py-3.5">
        <TutorAvatar gender={conversation.counterpartGender} photoUrl={conversation.counterpartPhotoUrl} name={conversation.counterpartName} size={50} />

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className={["flex-1 text-[15.5px] text-ink", unread ? "font-extrabold" : "font-semibold"].join(" ")} numberOfLines={1}>
              {conversation.counterpartName}
            </Text>
            {conversation.lastMessageAt ? (
              <Text className={["text-[11.5px]", unread ? "font-bold text-primary" : "text-ink-faint"].join(" ")}>
                {relativeTimeLabel(conversation.lastMessageAt)}
              </Text>
            ) : null}
          </View>

          <View className="mt-1 flex-row items-center gap-2">
            <Preview conversation={conversation} unread={unread > 0} />
            {unread > 0 ? (
              <View className="min-w-[20px] items-center rounded-full bg-primary px-1.5 py-[2px]">
                <Text className="text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</Text>
              </View>
            ) : null}
          </View>
          {conversation.status === "read_only" ? (
            <Text className="mt-1 text-[11px] text-ink-faint">{t("chat.conversationsListView.readOnly")}</Text>
          ) : null}
        </View>
      </View>
      {/* Séparateur fin, indenté à partir du texte : l'avatar reste dégagé. */}
      {last ? null : <View className="ml-[80px] h-px bg-line-soft" />}
    </PressableScale>
  );
}
