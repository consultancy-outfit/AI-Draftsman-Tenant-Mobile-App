import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Icon, Loader } from '@/components/ui';
import type { AiLearningStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_LEARNING_COPY } from './aiLearning.data';
import { AI_PROGRESS_STATE_LABELS, aiErrorKind, coursePercent } from './aiLearning.logic';
import type { AiQuizSummary } from './aiLearning.types';
import { useGetAiCourseQuery } from './aiLearningApi';
import { ProgressBar } from './components/ProgressBar';

type Nav = NativeStackNavigationProp<AiLearningStackParamList, 'AiCourseDetail'>;

/**
 * One course: its modules, each with lessons (ticked when complete) and a
 * module quiz, then the final quiz. "Resume" jumps to the first incomplete
 * lesson and is hidden when every lesson is done.
 */
export function AiCourseDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { slug, title } = useRoute<RouteProp<AiLearningStackParamList, 'AiCourseDetail'>>().params;
  const { data, isLoading, error, refetch } = useGetAiCourseQuery(slug);
  const back = () => navigation.goBack();

  if (isLoading || error || !data) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <AppHeader title={title ?? 'Course'} mode="stack" onBack={back} />
        {isLoading ? (
          <Loader label="Loading course…" />
        ) : aiErrorKind(error) === 'not_found' ? (
          <EmptyState icon="search-off" title={AI_LEARNING_COPY.notFoundTitle} description={AI_LEARNING_COPY.notFoundDescription} />
        ) : (
          <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void refetch()} />
        )}
      </View>
    );
  }

  const percent = coursePercent(data);
  const openQuiz = (q: AiQuizSummary) => navigation.navigate('AiQuiz', { quizId: q.id, title: q.title });

  const quizRow = (q: AiQuizSummary, label: string) => (
    <TouchableOpacity
      key={q.id}
      onPress={() => openQuiz(q)}
      accessibilityRole="button"
      style={[styles.row, { borderTopColor: theme.colors.border }]}
    >
      <Icon name={q.passed ? 'verified' : 'quiz'} size={20} color={q.passed ? theme.colors.statusSuccessFg : theme.colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{label}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {q.questionCount} questions · pass mark {q.passPct}%
          {q.bestScorePct !== null ? ` · best ${Math.round(q.bestScorePct)}%` : ''}
          {q.passed ? ' · Passed' : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader title={data.title} mode="stack" onBack={back} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl, lineHeight: 30 }}>{data.title}</Text>
        {data.summary ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{data.summary}</Text>
        ) : null}
        <View style={{ gap: 6 }}>
          <ProgressBar percent={percent} />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
            {AI_PROGRESS_STATE_LABELS[data.state]} · {data.completedLessons}/{data.lessonCount} lessons complete
          </Text>
        </View>

        {data.resumeLessonId ? (
          <Button
            label={data.completedLessons > 0 ? 'Resume' : 'Start course'}
            icon="play-arrow"
            onPress={() => navigation.navigate('AiLesson', { lessonId: data.resumeLessonId as string })}
            fullWidth
          />
        ) : null}

        {data.modules.map((m, i) => (
          <Card key={m.id} padded={false}>
            <View style={{ padding: 14, gap: 2 }}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>MODULE {i + 1}</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{m.title}</Text>
              {m.summary ? (
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{m.summary}</Text>
              ) : null}
            </View>
            {m.lessons.map((l) => (
              <TouchableOpacity
                key={l.id}
                onPress={() => navigation.navigate('AiLesson', { lessonId: l.id, title: l.title })}
                accessibilityRole="button"
                style={[styles.row, { borderTopColor: theme.colors.border }]}
              >
                <Icon
                  name={l.completed ? 'check-circle' : 'radio-button-unchecked'}
                  size={20}
                  color={l.completed ? theme.colors.statusSuccessFg : theme.colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>{l.title}</Text>
                  {l.estMinutes ? (
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{l.estMinutes} min</Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
            {m.quiz ? quizRow(m.quiz, 'Module quiz') : null}
          </Card>
        ))}

        {data.finalQuiz ? <Card padded={false}>{quizRow(data.finalQuiz, 'Final quiz')}</Card> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
