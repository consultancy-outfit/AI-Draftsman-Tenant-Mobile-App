import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, MarkdownText, useToast } from '@/components/ui';
import type { AiLearningStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_LEARNING_COPY } from './aiLearning.data';
import { aiErrorKind } from './aiLearning.logic';
import { useCompleteAiLessonMutation, useGetAiLessonQuery } from './aiLearningApi';
import { UpdateCard } from './components/UpdateCard';

type Nav = NativeStackNavigationProp<AiLearningStackParamList, 'AiLesson'>;

/**
 * One lesson: markdown body, previous/next, "Mark complete" (the only thing
 * that completes a lesson), related updates, and the module quiz once the
 * server offers it. Opening the lesson makes the server record a LESSON view.
 */
export function AiLessonScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { lessonId } = useRoute<RouteProp<AiLearningStackParamList, 'AiLesson'>>().params;
  const { data, isLoading, error, refetch } = useGetAiLessonQuery(lessonId);
  const [complete, { isLoading: completing }] = useCompleteAiLessonMutation();
  const back = () => navigation.goBack();

  if (isLoading || error || !data) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <AppHeader title="Lesson" mode="stack" onBack={back} />
        {isLoading ? (
          <Loader label="Loading lesson…" />
        ) : aiErrorKind(error) === 'not_found' ? (
          <EmptyState icon="search-off" title={AI_LEARNING_COPY.notFoundTitle} description={AI_LEARNING_COPY.notFoundDescription} />
        ) : (
          <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void refetch()} />
        )}
      </View>
    );
  }

  const markComplete = async () => {
    try {
      await complete(data.id).unwrap();
    } catch {
      toast.show(AI_LEARNING_COPY.completeFailed, { tone: 'error' });
    }
  };
  const goLesson = (id: string) => navigation.replace('AiLesson', { lessonId: id });
  const now = Date.now();

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader title={data.course.title} mode="stack" onBack={back} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
          {data.module.title}
        </Text>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl, lineHeight: 30 }}>{data.title}</Text>

        {data.short ? (
          <Button
            label={`Watch the short · ${data.short.title}`}
            icon="slideshow"
            variant="outline"
            onPress={() => navigation.navigate('AiLearningHome', { tab: 'shorts', shortId: data.short?.id as string })}
            fullWidth
          />
        ) : null}

        <MarkdownText content={data.bodyMd} />

        {data.completed ? (
          <Button label={AI_LEARNING_COPY.completed} icon="check-circle" variant="outline" disabled onPress={() => undefined} fullWidth />
        ) : (
          <Button label={AI_LEARNING_COPY.markComplete} icon="check" loading={completing} onPress={() => void markComplete()} fullWidth />
        )}

        {data.quiz ? (
          <Button
            label={data.quiz.passed ? 'Module quiz · Passed' : 'Take the module quiz'}
            icon="quiz"
            variant="outline"
            onPress={() => navigation.navigate('AiQuiz', { quizId: data.quiz?.id as string, title: data.quiz?.title })}
            fullWidth
          />
        ) : null}

        <View style={styles.navRow}>
          <View style={{ flex: 1 }}>
            {data.previousLessonId ? <Button label="Previous" icon="chevron-left" variant="outline" onPress={() => goLesson(data.previousLessonId as string)} fullWidth /> : null}
          </View>
          <View style={{ flex: 1 }}>
            {data.nextLessonId ? <Button label="Next" icon="chevron-right" iconPosition="right" variant="outline" onPress={() => goLesson(data.nextLessonId as string)} fullWidth /> : null}
          </View>
        </View>

        {data.relatedUpdates.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Related updates</Text>
            {data.relatedUpdates.map((u) => (
              <UpdateCard key={u.id} update={u} now={now} onPress={() => navigation.navigate('AiUpdateDetail', { updateId: u.id, title: u.title })} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 14 },
  navRow: { flexDirection: 'row', gap: 10 },
});
