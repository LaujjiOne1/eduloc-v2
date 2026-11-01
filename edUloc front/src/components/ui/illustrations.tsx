import { Circle, G, Line, Path, Rect, Svg } from "react-native-svg";

export type IllustrationName = "calendar" | "notebook" | "search" | "chat";

const PRIMARY = "#332E86";
const TINT = "#ECEAF9";
const VIOLET = "#8D7FE3";
const ACCENT = "#0E9C82";
const AMBER = "#D4890A";
const INK = "#14162B";

/** Un calendrier traversé par une boussole : « aucun créneau », « rien de prévu ». */
function CalendarCompass() {
  return (
    <G>
      <Rect x="18" y="24" width="68" height="62" rx="12" fill="#FFFFFF" stroke={PRIMARY} strokeWidth="2.5" />
      <Path d="M18 38 a12 12 0 0 1 12 -14 h44 a12 12 0 0 1 12 14 v2 H18 Z" fill={PRIMARY} />
      <Line x1="36" y1="17" x2="36" y2="30" stroke={PRIMARY} strokeWidth="3.5" strokeLinecap="round" />
      <Line x1="68" y1="17" x2="68" y2="30" stroke={PRIMARY} strokeWidth="3.5" strokeLinecap="round" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <Circle key={`${row}-${col}`} cx={30 + col * 14} cy={54 + row * 11} r="2.4" fill={row === 1 && col === 2 ? VIOLET : "#D5D7E2"} />
        )),
      )}
      <Circle cx="82" cy="82" r="20" fill="#FFFFFF" stroke={ACCENT} strokeWidth="3" />
      <Circle cx="82" cy="82" r="14" fill={TINT} />
      <Path d="M82 70 l5 12 -5 -2.5 -5 2.5 Z" fill={AMBER} />
      <Path d="M82 94 l-5 -12 5 2.5 5 -2.5 Z" fill={PRIMARY} />
      <Circle cx="82" cy="82" r="2" fill="#FFFFFF" />
    </G>
  );
}

/** Un carnet et son crayon : « aucun historique », « aucun bénéficiaire ». */
function Notebook() {
  return (
    <G>
      <Rect x="26" y="20" width="58" height="76" rx="10" fill={PRIMARY} />
      <Rect x="34" y="20" width="50" height="76" rx="8" fill="#FFFFFF" stroke={PRIMARY} strokeWidth="2.5" />
      {[32, 46, 60, 74].map((y) => (
        <Rect key={y} x="26" y={y - 3} width="14" height="6" rx="3" fill={VIOLET} />
      ))}
      <Line x1="48" y1="36" x2="74" y2="36" stroke="#D5D7E2" strokeWidth="3" strokeLinecap="round" />
      <Line x1="48" y1="50" x2="70" y2="50" stroke="#D5D7E2" strokeWidth="3" strokeLinecap="round" />
      <Line x1="48" y1="64" x2="66" y2="64" stroke="#D5D7E2" strokeWidth="3" strokeLinecap="round" />
      <G transform="rotate(35 88 78)">
        <Rect x="82" y="46" width="12" height="46" rx="3" fill={AMBER} />
        <Path d="M82 92 h12 l-6 12 Z" fill={INK} />
        <Rect x="82" y="46" width="12" height="9" rx="3" fill={ACCENT} />
      </G>
    </G>
  );
}

/** Une loupe sur un repère de carte : « aucun tuteur trouvé ». */
function SearchPin() {
  return (
    <G>
      <Path d="M52 18 c-14 0 -25 11 -25 25 c0 18 25 40 25 40 s25 -22 25 -40 c0 -14 -11 -25 -25 -25 Z" fill={PRIMARY} />
      <Circle cx="52" cy="43" r="10" fill="#FFFFFF" />
      <Circle cx="52" cy="43" r="4.5" fill={VIOLET} />
      <Circle cx="82" cy="78" r="18" fill="#FFFFFF" stroke={ACCENT} strokeWidth="4" />
      <Line x1="95" y1="91" x2="106" y2="102" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" />
      <Path d="M74 78 h16" stroke={AMBER} strokeWidth="3.5" strokeLinecap="round" />
    </G>
  );
}

/** Deux bulles de message : « aucune conversation ». */
function ChatBubbles() {
  return (
    <G>
      <Path d="M24 30 a12 12 0 0 1 12 -12 h40 a12 12 0 0 1 12 12 v22 a12 12 0 0 1 -12 12 h-26 l-14 12 v-12 a12 12 0 0 1 -12 -12 Z" fill={PRIMARY} />
      <Line x1="38" y1="34" x2="74" y2="34" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      <Line x1="38" y1="46" x2="62" y2="46" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      <Path d="M58 62 a10 10 0 0 1 10 -10 h24 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-4 v10 l-12 -10 h-8 a10 10 0 0 1 -10 -10 Z" fill="#FFFFFF" stroke={ACCENT} strokeWidth="3" />
      <Circle cx="72" cy="70" r="2.6" fill={ACCENT} />
      <Circle cx="82" cy="70" r="2.6" fill={ACCENT} />
      <Circle cx="92" cy="70" r="2.6" fill={ACCENT} />
    </G>
  );
}

const DRAWINGS: Record<IllustrationName, () => React.JSX.Element> = {
  calendar: CalendarCompass,
  notebook: Notebook,
  search: SearchPin,
  chat: ChatBubbles,
};

/** Illustration au trait des écrans vides, aux couleurs d'EduLoc, posée sur un disque teinté. */
export function Illustration({ name, size = 132 }: { name: IllustrationName; size?: number }) {
  const Drawing = DRAWINGS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx="60" cy="62" r="52" fill={TINT} />
      <Circle cx="100" cy="24" r="5" fill={AMBER} opacity="0.85" />
      <Circle cx="16" cy="40" r="3.5" fill={VIOLET} opacity="0.7" />
      <Drawing />
    </Svg>
  );
}
