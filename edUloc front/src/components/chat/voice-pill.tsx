import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { MicIcon, PauseIcon, SendIcon, TrashIcon, XIcon } from "@/components/icons";
import { PressableScale } from "@/components/motion/pressable-scale";
import { FormError } from "@/components/ui/form-error";
import { formatDuration } from "@/hooks/use-elapsed-seconds";
import { useSendMessage } from "@/hooks/use-send-message";
import { type RecordedVoice, useVoiceRecorder } from "@/hooks/use-voice-recorder";

/** Nombre de barres de la forme d'onde en direct. */
const BAR_COUNT = 28;
/** En dessous, le serveur refuse le vocal (durationMs ≥ 500). */
const MIN_VOICE_MS = 800;
/** Un seul ressort pour toute la capsule : elle s'allonge, ses éléments glissent avec elle. */
const MORPH = LinearTransition.springify().damping(22).stiffness(260).mass(0.9);

type VoicePillProps = {
  bookingId: string | undefined;
  /** Un vocal est parti : le fil de la conversation se relit. */
  onSent: () => void;
  /** La capsule d'enregistrement prend toute la largeur : le bouton « document » se masque pendant ce temps. */
  onActiveChange?: (active: boolean) => void;
};

/**
 * Message vocal « en capsule », sans quitter la conversation : un toucher sur « Enregistrer un vocal » transforme la
 * capsule en enregistreur (corbeille, minuteur, forme d'onde en direct, pause, envoyer). Plus d'écran dédié.
 */
export function VoicePill({ bookingId, onSent, onActiveChange }: VoicePillProps) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);

  const setActive = (active: boolean) => {
    setRecording(active);
    onActiveChange?.(active);
  };

  return (
    <Animated.View layout={MORPH} style={{ flex: 1 }}>
      {recording ? (
        <RecordingPill bookingId={bookingId} onClose={() => setActive(false)} onSent={onSent} />
      ) : (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(90)}>
          <PressableScale
            onPress={() => (bookingId ? setActive(true) : undefined)}
            disabled={!bookingId}
            accessibilityLabel={t("chat.conversationView.recordAVoiceMessage")}
          >
            <View className="h-[52px] w-full flex-row items-center justify-center gap-[10px] rounded-full bg-primary px-[22px]">
              <MicIcon size={18} color="#fff" />
              <Text className="text-[15px] font-semibold text-white">{t("chat.conversationView.recordAVoiceNote")}</Text>
            </View>
          </PressableScale>
        </Animated.View>
      )}
    </Animated.View>
  );
}

type RecordingPillProps = {
  bookingId: string | undefined;
  onClose: () => void;
  onSent: () => void;
};

/** L'enregistreur démarre au montage (le micro s'ouvre dès que la capsule apparaît) et s'arrête quand elle disparaît. */
function RecordingPill({ bookingId, onClose, onSent }: RecordingPillProps) {
  const { t } = useTranslation();
  const recorder = useVoiceRecorder();
  const { state, sendVoice, reset } = useSendMessage();
  const isSending = state.status === "sending";
  const [localError, setLocalError] = useState<string | null>(null);
  // Si l'envoi échoue (réseau…), le vocal reste prêt : « Envoyer » le renvoie sans réenregistrer.
  const [pendingVoice, setPendingVoice] = useState<RecordedVoice | null>(null);
  const sentOnLimit = useRef(false);

  // Niveaux sonores récents (forme d'onde qui défile de droite à gauche).
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0.1));
  const levelTick = `${recorder.phase}|${recorder.level}|${recorder.durationMs}`;
  const [lastLevelTick, setLastLevelTick] = useState(levelTick);
  if (levelTick !== lastLevelTick) {
    setLastLevelTick(levelTick);
    if (recorder.phase === "recording") setLevels((previous) => [...previous.slice(1), Math.max(0.1, recorder.level)]);
  }

  const handleDiscard = async () => {
    await recorder.cancel();
    onClose();
  };

  const handleSend = async () => {
    if (!bookingId || isSending) return;
    setLocalError(null);
    reset();
    const voice = pendingVoice ?? (await recorder.stop());
    if (!voice) return;
    if (voice.durationMs < MIN_VOICE_MS) {
      setLocalError(t("chat.voiceRecordingView.messageTooShortHoldThe"));
      return;
    }
    setPendingVoice(voice);
    const message = await sendVoice(bookingId, voice);
    if (message) {
      setPendingVoice(null);
      onSent();
      onClose();
    }
  };

  // Limite atteinte : l'enregistrement s'arrête et le vocal part tel quel.
  useEffect(() => {
    if (recorder.reachedLimit && !sentOnLimit.current) {
      sentOnLimit.current = true;
      void handleSend();
    }
    // handleSend change à chaque rendu ; seul le franchissement de la limite doit déclencher l'envoi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.reachedLimit]);

  const unavailable = recorder.phase === "denied" || recorder.phase === "error";
  const live = recorder.phase === "recording";
  const paused = recorder.phase === "paused";
  const canSend = live || paused || pendingVoice !== null;

  if (unavailable) {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(90)}>
        <View className="flex-row items-center gap-3 rounded-[28px] border border-error/30 bg-error-tint px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
            <MicIcon size={17} color="#AC4A40" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[13.5px] font-bold text-ink">
              {recorder.phase === "denied" ? t("chat.voiceRecordingView.microphoneAccessDenied") : t("chat.voiceRecordingView.recordingUnavailable")}
            </Text>
            <Text className="text-[12px] leading-[16px] text-ink-soft">
              {recorder.phase === "denied" ? t("chat.voiceRecordingView.allowTheMicrophoneInYour") : recorder.errorMessage}
            </Text>
          </View>
          <PressableScale onPress={onClose} accessibilityLabel={t("common.close")}>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
              <XIcon size={15} color="#14162B" />
            </View>
          </PressableScale>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(90)}>
      {localError ? <FormError message={localError} /> : null}
      {state.status === "error" ? <FormError message={state.message} /> : null}

      <View
        className="h-[56px] flex-row items-center gap-2 rounded-full border border-line-soft bg-surface pl-1.5 pr-1.5"
        style={{ shadowColor: "#1E1B4B", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <PillButton label={t("common.cancel")} onPress={handleDiscard} disabled={isSending}>
          <TrashIcon size={18} color="#585B78" />
        </PillButton>

        <View className="flex-row items-center gap-1.5">
          <RecDot active={live} />
          <Text className="w-[44px] text-[14px] font-semibold text-ink" style={{ fontVariant: ["tabular-nums"] }} accessibilityRole="timer">
            {recorder.phase === "starting" ? "00:00" : formatDuration(recorder.seconds)}
          </Text>
        </View>

        {/* Forme d'onde en direct : les plus anciennes barres s'estompent vers la gauche. */}
        <View className="h-full min-w-0 flex-1 flex-row items-center justify-end gap-[2.5px] overflow-hidden">
          {levels.map((level, index) => (
            <View
              key={index}
              style={{
                width: 2.5,
                height: Math.max(3, level * 28),
                borderRadius: 2,
                backgroundColor: "#332E86",
                opacity: (live ? 0.9 : 0.35) * Math.min(1, (index + 1) / (BAR_COUNT * 0.35)),
              }}
            />
          ))}
        </View>

        {pendingVoice ? null : (
          <PillButton
            label={paused ? t("chat.voicePill.resume") : t("chat.voicePill.pause")}
            onPress={paused ? recorder.resume : recorder.pause}
            disabled={isSending || recorder.phase === "starting"}
          >
            {paused ? <MicIcon size={18} color="#585B78" /> : <PauseIcon size={18} color="#585B78" />}
          </PillButton>
        )}

        <PressableScale onPress={handleSend} disabled={isSending || !canSend} accessibilityLabel={t("common.send")}>
          <View className="h-[44px] w-[44px] items-center justify-center rounded-full bg-primary" style={{ opacity: canSend ? 1 : 0.4 }}>
            {isSending ? <ActivityIndicator size="small" color="#fff" /> : <SendIcon size={18} color="#fff" />}
          </View>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function PillButton({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <View className="h-[44px] w-[44px] items-center justify-center rounded-full" style={{ opacity: disabled ? 0.4 : 1 }}>
        {children}
      </View>
    </PressableScale>
  );
}

/** Point rouge qui pulse pendant l'enregistrement ; fixe et atténué en pause. */
function RecDot({ active }: { active: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (active) pulse.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
    else pulse.set(withTiming(0, { duration: 150 }));
  }, [active, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: active ? 1 - pulse.get() * 0.7 : 0.35 }));
  return <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#E04F5F" }, style]} />;
}
