import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/** Réserve verticale du message : constante, pour que la hauteur du tiroir ne bouge pas pendant que le texte va et vient. */
export const GREETING_MESSAGE_HEIGHT = 24;
/** Hauteur de la ligne du nom : c'est ce que le tiroir fermé laisse voir. */
export const GREETING_NAME_HEIGHT = 36;

const OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Minutage de la chorégraphie (ms). */
const NAME_IN_MS = 380;
const HELLO_DELAY_MS = 520;
const HELLO_IN_MS = 480;
const HELLO_HOLD_MS = 1500;
const HELLO_OUT_MS = 420;
const MESSAGE_IN_MS = 320;
const MESSAGE_HOLD_MS = 2600;
const MESSAGE_OUT_MS = 340;
const MESSAGE_GAP_MS = 140;

type GreetingBannerProps = {
  /** Prénom : il reste affiché, tout le reste disparaît. */
  name: string;
  /** « Bonjour » : entre par la gauche et POUSSE le prénom, puis ressort. */
  hello: string;
  /** Petites phrases adressées à l'utilisateur, l'une après l'autre (cours de la semaine, demandes, messages…). */
  messages: string[];
  /** Change à chaque ouverture du tiroir : la chorégraphie repart. */
  playKey: number;
  /** Tiroir ouvert ? Fermé, tout s'arrête et seul le prénom reste. */
  open: boolean;
  /** Données prêtes : on n'annonce pas « 0 cours » pendant que les réservations chargent. */
  ready: boolean;
};

/**
 * Salutation vivante du tiroir. À chaque ouverture : le prénom apparaît seul ; « Bonjour » glisse depuis la gauche et le
 * pousse vers la droite ; puis « Bonjour » repart et le prénom revient à sa place ; enfin quelques messages utiles
 * s'affichent un à un et s'effacent. Il ne reste que le prénom.
 */
export function GreetingBanner({ name, hello, messages, playKey, open, ready }: GreetingBannerProps) {
  const nameIn = useSharedValue(0);
  const helloShown = useSharedValue(0);
  const messageShown = useSharedValue(0);
  const [helloWidth, setHelloWidth] = useState(0);
  const [current, setCurrent] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Les messages vivent dans une référence : une relecture des données en cours de route ne relance pas la chorégraphie.
  const latestMessages = useRef(messages);
  useEffect(() => {
    latestMessages.current = messages;
  });

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const at = (delay: number, action: () => void) => {
      timers.current.push(setTimeout(action, delay));
    };
    clear();

    if (!open || !ready || helloWidth === 0) {
      // Fermé (ou pas prêt) : on revient à l'état de repos — le prénom seul.
      helloShown.set(withTiming(0, { duration: 160 }));
      messageShown.set(withTiming(0, { duration: 160 }));
      nameIn.set(withTiming(open ? 0 : 1, { duration: 160 }));
      return clear;
    }

    nameIn.set(0);
    helloShown.set(0);
    messageShown.set(0);
    // 1. le prénom, seul
    nameIn.set(withTiming(1, { duration: NAME_IN_MS, easing: OUT }));
    // 2. « Bonjour » entre et pousse le prénom
    at(HELLO_DELAY_MS, () => helloShown.set(withTiming(1, { duration: HELLO_IN_MS, easing: OUT })));
    // 3. « Bonjour » ressort, le prénom reprend sa place
    const helloOutAt = HELLO_DELAY_MS + HELLO_IN_MS + HELLO_HOLD_MS;
    at(helloOutAt, () => helloShown.set(withTiming(0, { duration: HELLO_OUT_MS, easing: Easing.inOut(Easing.cubic) })));
    // 4. les messages, un à un
    let clock = helloOutAt + HELLO_OUT_MS + 160;
    for (const message of latestMessages.current) {
      at(clock, () => {
        setCurrent(message);
        messageShown.set(withTiming(1, { duration: MESSAGE_IN_MS, easing: OUT }));
      });
      at(clock + MESSAGE_IN_MS + MESSAGE_HOLD_MS, () => messageShown.set(withTiming(0, { duration: MESSAGE_OUT_MS })));
      clock += MESSAGE_IN_MS + MESSAGE_HOLD_MS + MESSAGE_OUT_MS + MESSAGE_GAP_MS;
    }
    return clear;
  }, [playKey, open, ready, helloWidth, helloShown, messageShown, nameIn]);

  const nameStyle = useAnimatedStyle(() => ({ opacity: nameIn.get(), transform: [{ translateY: (1 - nameIn.get()) * 8 }] }));
  // La largeur de « Bonjour » grandit de 0 à sa largeur réelle : le prénom, à sa droite, est poussé.
  const helloStyle = useAnimatedStyle(() => ({
    width: helloShown.get() * helloWidth,
    opacity: helloShown.get(),
    transform: [{ translateX: (helloShown.get() - 1) * 10 }],
  }));
  const messageStyle = useAnimatedStyle(() => ({ opacity: messageShown.get(), transform: [{ translateY: (1 - messageShown.get()) * 6 }] }));

  return (
    <View className="px-5">
      <View style={{ height: GREETING_NAME_HEIGHT, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
        <Animated.View style={[{ overflow: "hidden", flexDirection: "row" }, helloStyle]}>
          <Text className="text-[26px] font-bold font-display text-primary" numberOfLines={1} style={{ width: helloWidth || undefined }}>
            {hello}
          </Text>
        </Animated.View>
        <Animated.Text className="shrink text-[26px] font-bold font-display text-ink" numberOfLines={1} style={nameStyle}>
          {name}
        </Animated.Text>
      </View>

      <View style={{ height: GREETING_MESSAGE_HEIGHT, justifyContent: "center" }}>
        <Animated.Text className="text-[14px] text-ink-soft" numberOfLines={1} style={messageStyle}>
          {current}
        </Animated.Text>
      </View>

      {/* Mesure invisible de « Bonjour » (avec l'espace qui le sépare du prénom). */}
      <Text
        className="absolute text-[26px] font-bold font-display opacity-0"
        pointerEvents="none"
        onLayout={(event) => setHelloWidth(Math.ceil(event.nativeEvent.layout.width) + 8)}
      >
        {hello}
      </Text>
    </View>
  );
}
