import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Loader } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_LEARNING_COPY } from '../aiLearning.data';
import { groupCoursesByTrack } from '../aiLearning.logic';
import type { AiCourseSummary } from '../aiLearning.types';
import { useGetAiCoursesQuery, useGetAiProvidersQuery } from '../aiLearningApi';
import { CourseCard } from '../components/CourseCard';

/**
 * AI Courses — two tracks: AI Fundamentals first, then one group per provider
 * (in the providers endpoint's order). Each course card shows lesson progress.
 */
export function AiCoursesSection({ onOpenCourse }: { onOpenCourse: (course: AiCourseSummary) => void }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { data: courses, isLoading, isFetching, error, refetch } = useGetAiCoursesQuery();
  const { data: providers } = useGetAiProvidersQuery();

  const grouped = useMemo(
    () => groupCoursesByTrack(courses ?? [], (providers ?? []).map((p) => ({ id: p.id, name: p.name }))),
    [courses, providers],
  );

  const heading = (text: string) => (
    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginTop: 6 }}>{text}</Text>
  );

  let body;
  if (isLoading) body = <Loader label="Loading courses…" />;
  else if (error && !courses)
    body = <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void refetch()} />;
  else if (!courses || courses.length === 0) body = <EmptyState icon="psychology" title={AI_LEARNING_COPY.coursesEmptyTitle} />;
  else
    body = (
      <>
        {grouped.fundamentals.length > 0 ? (
          <View style={styles.group}>
            {heading('AI Fundamentals')}
            {grouped.fundamentals.map((c) => (
              <CourseCard key={c.id} course={c} onPress={() => onOpenCourse(c)} />
            ))}
          </View>
        ) : null}
        {grouped.providers.map((g) => (
          <View key={g.providerId} style={styles.group}>
            {heading(g.providerName)}
            {g.courses.map((c) => (
              <CourseCard key={c.id} course={c} onPress={() => onOpenCourse(c)} />
            ))}
          </View>
        ))}
      </>
    );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
    >
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        {AI_LEARNING_COPY.coursesDescription}
      </Text>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  group: { gap: 10 },
});
