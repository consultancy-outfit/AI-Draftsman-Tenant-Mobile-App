import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The deck's card colour, as on web/desktop (`DeckStage` in SlideDeck.styles.ts):
 * black with the provider's accent glowing from the top-left and fading out by
 * 70% of the way across. Text stays on white, so it reads on any accent.
 */
export function DeckBackground({ accent }: { accent: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        {/* CSS: radial-gradient(120% 80% at 20% 0%, accent@0.55, transparent 70%) */}
        <RadialGradient id="deckGlow" cx="0.2" cy="0" rx="1.2" ry="0.8" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={accent} stopOpacity={0.55} />
          <Stop offset="0.7" stopColor={accent} stopOpacity={0} />
          <Stop offset="1" stopColor={accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="#000" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#deckGlow)" />
    </Svg>
  );
}

/** A progress-segment fill: white fading to the accent, as on web. */
export function SegmentFill({ accent }: { accent: string }) {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="segFill" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" />
          <Stop offset="1" stopColor={accent} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#segFill)" />
    </Svg>
  );
}
