import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useAppTheme } from '@/theme/ThemeContext';

import type { ViewMilestone, ViewMilestoneTracker } from '../aiLearning.logic';
import { formatDuration } from '../aiLearning.logic';
import type { AiShortSummary } from '../aiLearning.types';
import { isSlideShort } from '../slideDeck.logic';
import { SlideDeckPlayer } from './SlideDeckPlayer';
import { VideoShort } from './VideoShort';

interface ShortItemProps {
  short: AiShortSummary;
  height: number;
  /** Holds a player (the current short, or the next one). */
  mounted: boolean;
  /** On screen now: plays. */
  current: boolean;
  tracker: ViewMilestoneTracker;
  onMilestone: (shortId: string, milestone: ViewMilestone, positionS: number) => void;
  onOpenUpdate: (updateId: string) => void;
  onOpenLesson: (lessonId: string, title: string) => void;
}

/**
 * One full-height short. A slide deck and an MP4 share this slot (`isSlideShort`
 * decides); a short that is not mounted shows its poster so scrolling past it
 * costs no decoder.
 */
export function ShortItem({ short, height, mounted, current, tracker, onMilestone, onOpenUpdate, onOpenLesson }: ShortItemProps) {
  const { theme } = useAppTheme();
  const slides = isSlideShort(short);

  return (
    <View style={[styles.root, { height, backgroundColor: '#000' }]}>
      {mounted ? (
        slides ? (
          <SlideDeckPlayer short={short as Parameters<typeof SlideDeckPlayer>[0]['short']} current={current} tracker={tracker} onMilestone={onMilestone} onOpenUpdate={onOpenUpdate} onOpenLesson={onOpenLesson} />
        ) : (
          <VideoShort short={short} current={current} tracker={tracker} onMilestone={onMilestone} />
        )
      ) : (
        <View style={styles.poster}>
          {short.thumbnailUrl ? <Image source={{ uri: short.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
      )}

      {/* Caption over a video; a deck draws its own heading, so it gets a slim title only. */}
      {!slides || !mounted ? (
        <View style={styles.caption} pointerEvents="none">
          {short.provider ? (
            <View style={styles.providerRow}>
              <View style={[styles.dot, { backgroundColor: short.provider.color || theme.colors.accent }]} />
              <Text style={styles.provider}>{short.provider.name}</Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {short.title}
          </Text>
          {short.durationS ? <Text style={styles.meta}>{formatDuration(short.durationS)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', overflow: 'hidden' },
  poster: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 4, backgroundColor: 'rgba(0,0,0,0.45)' },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  provider: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
});
