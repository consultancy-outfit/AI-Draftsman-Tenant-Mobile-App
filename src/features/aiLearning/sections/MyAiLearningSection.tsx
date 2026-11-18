import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, Icon, Loader } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_HISTORY_LIMIT, AI_LEARNING_COPY } from '../aiLearning.data';
import { relativeTime } from '../aiLearning.logic';
import type { AiContentType, AiCourseSummary, AiHistoryItem } from '../aiLearning.types';
import { useGetAiMyHistoryQuery, useGetAiMyProgressQuery } from '../aiLearningApi';
import { CourseCard } from '../components/CourseCard';

const CONTENT_LABELS: Record<AiContentType, string> = {
  NEWS: 'Update',
  SHORT: 'Short',
  COURSE: 'Course',
  LESSON: 'Lesson',
  ASSESSMENT: 'Quiz',
};
const CONTENT_ICONS: Record<AiContentType, 'dynamic-feed' | 'slideshow' | 'school' | 'menu-book' | 'quiz'> = {
  NEWS: 'dynamic-feed',
  SHORT: 'slideshow',
  COURSE: 'school',
  LESSON: 'menu-book',
  ASSESSMENT: 'quiz',
};

interface MyAiLearningSectionProps {
  onOpenCourse: (course: Pick<AiCourseSummary, 'slug' | 'title'>) => void;
  onOpenHistory: (item: AiHistoryItem) => void;
}

/**
 * My AI learning — the learner's own counts, courses in progress and completed,
 * quiz attempt history and the 20 most recent things they opened. Separate from
 * the apprenticeship "My Learning" on web. Tapping a lesson, update or short in
 * the history reopens it; courses and quizzes open their course.
 */
export function MyAiLearningSection({ onOpenCourse, onOpenHistory }: MyAiLearningSectionProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const progress = useGetAiMyProgressQuery();
  const history = useGetAiMyHistoryQuery({ limit: AI_HISTORY_LIMIT });
  const now = Date.now();

  const refreshing = (progress.isFetching || history.isFetching) && !progress.isLoading;
  const refresh = () => {
    void progress.refetch();
    void history.refetch();
  };

  const heading = (text: string) => (
    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginTop: 6 }}>{text}</Text>
  );

  let body;
  if (progress.isLoading) body = <Loader label="Loading your progress…" />;
  else if (progress.error || !progress.data)
    body = <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={refresh} />;
  else {
    const p = progress.data;
    const counts: Array<{ label: string; value: number; icon: 'dynamic-feed' | 'slideshow' | 'menu-book' | 'school' | 'verified' }> = [
      { label: 'Updates seen', value: p.counts.updatesSeen, icon: 'dynamic-feed' },
      { label: 'Shorts watched', value: p.counts.shortsWatched, icon: 'slideshow' },
      { label: 'Lessons completed', value: p.counts.lessonsCompleted, icon: 'menu-book' },
      { label: 'Courses completed', value: p.counts.coursesCompleted, icon: 'school' },
      { label: 'Quizzes passed', value: p.counts.quizzesPassed, icon: 'verified' },
    ];
    const items = history.data ?? [];
    body = (
      <>
        <View style={styles.grid}>
          {counts.map((c) => (
            <Card key={c.label} style={styles.tile}>
              <Icon name={c.icon} size={20} color={theme.colors.accent} />
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl }}>{c.value}</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{c.label}</Text>
            </Card>
          ))}
        </View>

        {p.inProgress.length > 0 ? (
          <View style={styles.group}>
            {heading('In progress')}
            {p.inProgress.map((c) => (
              <CourseCard key={c.id} course={c} onPress={() => onOpenCourse(c)} />
            ))}
          </View>
        ) : null}

        {p.completed.length > 0 ? (
          <View style={styles.group}>
            {heading('Completed')}
            {p.completed.map((c) => (
              <CourseCard key={c.id} course={c} onPress={() => onOpenCourse(c)} />
            ))}
          </View>
        ) : null}

        {p.quizAttempts.length > 0 ? (
          <View style={styles.group}>
            {heading('Quiz attempts')}
            <Card padded={false}>
              {p.quizAttempts.map((a, i) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => onOpenCourse({ slug: a.courseSlug, title: a.quizTitle })}
                  accessibilityRole="button"
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}
                >
                  <Icon name={a.passed ? 'check-circle' : 'cancel'} size={20} color={a.passed ? theme.colors.statusSuccessFg : theme.colors.statusErrorFg} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{a.quizTitle}</Text>
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                      Attempt {a.attemptNo} · {Math.round(a.scorePct)}% ({a.score}/{a.maxScore}) · {a.passed ? 'Passed' : 'Not passed'} · {relativeTime(a.completedAt, now)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={styles.group}>
          {heading('Recent history')}
          {history.isLoading ? (
            <Loader label="Loading history…" />
          ) : history.error ? (
            <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void history.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon="history" title="Nothing here yet" description="Updates, shorts and lessons you open show up here." />
          ) : (
            <Card padded={false}>
              {items.map((h, i) => (
                <TouchableOpacity
                  key={`${h.contentType}:${h.contentId}`}
                  onPress={() => onOpenHistory(h)}
                  accessibilityRole="button"
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}
                >
                  <Icon name={CONTENT_ICONS[h.contentType] ?? 'history'} size={20} color={theme.colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>
                      {h.title ?? CONTENT_LABELS[h.contentType] ?? 'Item'}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                      {CONTENT_LABELS[h.contentType] ?? h.contentType} · {h.completed ? 'Completed' : `${Math.round(h.progress * 100)}%`} · {relativeTime(h.lastViewedAt, now)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </View>
      </>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.accent} />}
    >
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        {AI_LEARNING_COPY.myDescription}
      </Text>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /* Three per row on most phones (two on a very narrow one), growing to fill the last row. */
  tile: { flexGrow: 1, flexBasis: 104, gap: 4 },
  group: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
