import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type ViewToken } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { skipToken } from '@reduxjs/toolkit/query';
import { setAudioModeAsync } from 'expo-audio';

import { Button, EmptyState, ErrorState, Loader } from '@/components/ui';
import type { AiLearningStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_LEARNING_COPY, AI_SHORTS_PAGE_SIZE } from '../aiLearning.data';
import {
  createViewMilestoneTracker,
  isShortMounted,
  shortViewInput,
  shouldLoadMoreShorts,
  type ViewMilestone,
} from '../aiLearning.logic';
import { useGetAiShortQuery, useGetAiShortsQuery, useRecordAiViewMutation } from '../aiLearningApi';
import { ShortItem } from '../components/ShortItem';

/**
 * Shorts — a full-height vertical pager of video and slide-deck explainers.
 * Only the current and next short hold a player. Views are posted fire-and-forget
 * at start, 50% and end, once each per short per visit. `initialShortId` opens
 * the feed on that short (from an update or a lesson).
 */
export function AiShortsSection({ initialShortId }: { initialShortId?: string | undefined }) {
  const { theme } = useAppTheme();
  const focused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<AiLearningStackParamList>>();
  const openUpdate = useCallback((updateId: string) => navigation.navigate('AiUpdateDetail', { updateId }), [navigation]);
  const openLesson = useCallback((lessonId: string, title: string) => navigation.navigate('AiLesson', { lessonId, title }), [navigation]);
  /* iOS mutes narration when the ring/silent switch is on unless the session says otherwise. */
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
  }, []);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const { data, isLoading, isFetching, error, refetch } = useGetAiShortsQuery({ cursor, limit: AI_SHORTS_PAGE_SIZE });
  const { data: first } = useGetAiShortQuery(initialShortId ?? skipToken);
  const [record] = useRecordAiViewMutation();

  const items = useMemo(() => {
    const list = data?.items ?? [];
    return first ? [first, ...list.filter((s) => s.id !== first.id)] : list;
  }, [data, first]);

  const [height, setHeight] = useState(0);
  const [current, setCurrent] = useState(0);
  const tracker = useRef(createViewMilestoneTracker()).current;

  /* Fire and forget: a failed view post is dropped, never retried or shown. */
  const onMilestone = useCallback(
    (shortId: string, milestone: ViewMilestone, positionS: number) => {
      void record(shortViewInput(shortId, milestone, positionS));
    },
    [record],
  );

  const loadMoreIfNeeded = useCallback(
    (index: number) => {
      if (isFetching || !data?.nextCursor) return;
      if (shouldLoadMoreShorts(index, items.length, data.hasMore)) setCursor(data.nextCursor);
    },
    [isFetching, data, items.length],
  );

  const viewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const top = viewableItems.find((v) => v.isViewable && v.index != null);
    if (top?.index != null) setCurrent(top.index);
  });
  const viewConfig = useRef({ itemVisiblePercentThreshold: 75 });

  let body;
  if (isLoading) body = <Loader label="Loading shorts…" />;
  else if (error && items.length === 0)
    body = <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void refetch()} />;
  else if (items.length === 0) body = <EmptyState icon="slideshow" title={AI_LEARNING_COPY.shortsEmptyTitle} description={AI_LEARNING_COPY.shortsEmptyDescription} />;
  else if (height > 0)
    body = (
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        onViewableItemsChanged={viewable.current}
        viewabilityConfig={viewConfig.current}
        onMomentumScrollEnd={(e) => loadMoreIfNeeded(Math.round(e.nativeEvent.contentOffset.y / height))}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        renderItem={({ item, index }) => (
          <ShortItem
            short={item}
            height={height}
            mounted={focused && isShortMounted(index, current)}
            current={focused && index === current}
            tracker={tracker}
            onMilestone={onMilestone}
            onOpenUpdate={openUpdate}
            onOpenLesson={openLesson}
          />
        )}
        ListFooterComponent={
          error ? (
            <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
              <Button label={AI_LEARNING_COPY.retry} variant="outline" onPress={() => void refetch()} />
            </View>
          ) : null
        }
      />
    );

  return (
    <View style={[styles.flex, { backgroundColor: items.length ? '#000' : theme.colors.background }]} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
