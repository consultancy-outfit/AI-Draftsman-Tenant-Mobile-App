import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';

import { Button, Icon } from '@/components/ui';

import { AI_LEARNING_COPY } from '../aiLearning.data';
import { playbackFraction, type ViewMilestone, type ViewMilestoneTracker } from '../aiLearning.logic';
import type { AiShortSummary } from '../aiLearning.types';

interface VideoShortProps {
  short: AiShortSummary;
  /** The short on screen right now; the next one is mounted but paused. */
  current: boolean;
  tracker: ViewMilestoneTracker;
  onMilestone: (shortId: string, milestone: ViewMilestone, positionS: number) => void;
}

/**
 * An MP4 short. Only the current and next short mount this (see `isShortMounted`),
 * so the feed holds at most two decoders. Tap pauses/plays. View milestones
 * (start, 50%, end) are reported once each through the shared tracker.
 */
export function VideoShort({ short, current, tracker, onMilestone }: VideoShortProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const url = short.videoUrl;

  const player = useVideoPlayer(url ? { uri: url } : null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
  });
  const lastTime = useRef(0);

  useEffect(() => {
    if (!url || failed) return;
    if (current && !paused) player.play();
    else player.pause();
  }, [current, paused, player, url, failed, reloadKey]);

  /* A short that scrolls off starts again from the top if it comes back. */
  useEffect(() => {
    if (!current) setPaused(false);
  }, [current]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    lastTime.current = currentTime;
    if (!current) return;
    const fraction = playbackFraction(currentTime, player.duration, short.durationS);
    const fresh = tracker.take(short.id, fraction);
    const top = fresh[fresh.length - 1];
    if (top) onMilestone(short.id, top, currentTime);
  });
  useEventListener(player, 'playToEnd', () => {
    const fresh = tracker.take(short.id, 1, true);
    const top = fresh[fresh.length - 1];
    if (top) onMilestone(short.id, top, lastTime.current);
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setFailed(true);
  });

  if (!url || failed) {
    return (
      <View style={styles.center}>
        <Icon name="error-outline" size={36} color="#fff" />
        <Text style={styles.errorTitle}>{AI_LEARNING_COPY.videoErrorTitle}</Text>
        <Text style={styles.errorBody}>{AI_LEARNING_COPY.videoErrorDescription}</Text>
        <Button
          label={AI_LEARNING_COPY.retry}
          variant="outline"
          onPress={() => {
            setFailed(false);
            setReloadKey((k) => k + 1);
            player.replay();
          }}
        />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => setPaused((p) => !p)} accessibilityLabel={paused ? 'Play' : 'Pause'}>
      <View style={StyleSheet.absoluteFill}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} allowsFullscreen={false} />
        {paused ? (
          <View style={styles.pauseBadge} pointerEvents="none">
            <Icon name="play-arrow" size={48} color="#fff" />
          </View>
        ) : null}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  errorBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  pauseBadge: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
});
