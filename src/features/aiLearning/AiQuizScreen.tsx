import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import type { AiLearningStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';
import { newIdempotencyKey } from '@/utils/ids';

import { AI_LEARNING_COPY } from './aiLearning.data';
import {
  aiErrorKind,
  allAnswered,
  answeredCount,
  attemptsLeftLabel,
  attemptsRemaining,
  buildSubmitInput,
  canRetry,
  incorrectAnswers,
  isAnswered,
  isMultiSelect,
  questionCounter,
  scoreLine,
  selectOption,
  type QuizAnswers,
} from './aiLearning.logic';
import type { AiQuizQuestion, AiQuizResult } from './aiLearning.types';
import { useGetAiQuizQuery, useSubmitAiQuizMutation } from './aiLearningApi';
import { ProgressBar } from './components/ProgressBar';

type Nav = NativeStackNavigationProp<AiLearningStackParamList, 'AiQuiz'>;

/**
 * A quiz, one question at a time (single, multi, true/false, scenario), then a
 * result with a review of the wrong answers. The `Idempotency-Key` is minted on
 * the first submit of an attempt and kept until it succeeds, so a retry after a
 * flaky connection returns the first result instead of burning a second attempt.
 * "Try again" starts a new attempt with a new key.
 */
export function AiQuizScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { quizId } = useRoute<RouteProp<AiLearningStackParamList, 'AiQuiz'>>().params;
  const { data: quiz, isLoading, error, refetch } = useGetAiQuizQuery(quizId);
  const [submit, { isLoading: submitting }] = useSubmitAiQuizMutation();

  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AiQuizResult | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const startedAt = useRef(new Date().toISOString());
  const back = () => navigation.goBack();

  const optionText = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of quiz?.questions ?? []) for (const o of q.options) map.set(o.id, o.text);
    return map;
  }, [quiz]);

  const shell = (children: React.ReactNode) => (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader title={quiz?.title ?? 'Quiz'} mode="stack" onBack={back} />
      {children}
    </View>
  );

  if (isLoading) return shell(<Loader label="Loading quiz…" />);
  if (error || !quiz) {
    return shell(
      aiErrorKind(error) === 'not_found' ? (
        <EmptyState icon="search-off" title={AI_LEARNING_COPY.notFoundTitle} description={AI_LEARNING_COPY.notFoundDescription} />
      ) : (
        <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void refetch()} />
      ),
    );
  }

  const noAttemptsLeft = exhausted || (!result && attemptsRemaining(quiz) === 0);
  if (noAttemptsLeft) {
    return shell(
      <EmptyState icon="block" title={AI_LEARNING_COPY.attemptsExhaustedTitle} description={AI_LEARNING_COPY.attemptsExhaustedDescription} actionLabel="Back" onAction={back} />,
    );
  }

  const startNewAttempt = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    idempotencyKey.current = null;
    startedAt.current = new Date().toISOString();
  };

  const onSubmit = async () => {
    if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();
    try {
      const res = await submit({
        quizId: quiz.id,
        ...buildSubmitInput(answers, quiz.questions, startedAt.current),
        idempotencyKey: idempotencyKey.current,
      }).unwrap();
      idempotencyKey.current = null;
      setResult(res);
    } catch (e) {
      const kind = aiErrorKind(e);
      if (kind === 'attempts_exhausted') setExhausted(true);
      else if (kind === 'invalid_answers') {
        toast.show(AI_LEARNING_COPY.invalidAnswers, { tone: 'warning' });
        startNewAttempt();
        void refetch();
      } else toast.show(AI_LEARNING_COPY.quizSubmitFailed, { tone: 'error' });
    }
  };

  /* ── Result ─────────────────────────────────────────────────────────────── */
  if (result) {
    const wrong = incorrectAnswers(result);
    const listOf = (ids: string[]) => (ids.length ? ids.map((id) => optionText.get(id) ?? id).join(', ') : '—');
    return shell(
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Card style={{ gap: 6, alignItems: 'center' }}>
          <Icon
            name={result.passed ? 'check-circle' : 'cancel'}
            size={40}
            color={result.passed ? theme.colors.statusSuccessFg : theme.colors.statusErrorFg}
          />
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.lg, textAlign: 'center' }}>{scoreLine(result)}</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
            Pass mark {result.passPct}% · {attemptsLeftLabel(result.attemptsLeft)}
          </Text>
          {result.courseCompleted ? (
            <Text style={{ color: theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>Course completed 🎉</Text>
          ) : null}
        </Card>

        {wrong.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Review</Text>
            {wrong.map((r) => (
              <Card key={r.questionId} style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{r.prompt}</Text>
                <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>Your answer: {listOf(r.chosen)}</Text>
                <Text style={{ color: theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>Correct: {listOf(r.correct)}</Text>
                {r.explanation ? (
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{r.explanation}</Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}

        {!result.passed && canRetry(result) ? <Button label="Try again" icon="refresh" onPress={startNewAttempt} fullWidth /> : null}
        <Button label="Back to course" variant="outline" onPress={back} fullWidth />
      </ScrollView>,
    );
  }

  /* ── Question ───────────────────────────────────────────────────────────── */
  const total = quiz.questions.length;
  if (total === 0) return shell(<EmptyState icon="quiz" title="This quiz has no questions yet" />);
  const question: AiQuizQuestion = quiz.questions[Math.min(index, total - 1)] as AiQuizQuestion;
  const chosen = answers[question.id] ?? [];
  const multi = isMultiSelect(question.type);
  const last = index >= total - 1;

  return shell(
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
          {questionCounter(index, total)} · {answeredCount(answers, quiz.questions)} answered
        </Text>
        <ProgressBar percent={((index + 1) / total) * 100} />
      </View>

      {question.type === 'SCENARIO' ? (
        <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 }}>Scenario</Text>
      ) : null}
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, lineHeight: 26 }}>{question.prompt}</Text>
      {multi && !/select all that apply/i.test(question.prompt) ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>Select all that apply</Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {question.options.map((o) => {
          const on = chosen.includes(o.id);
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => setAnswers((a) => selectOption(a, question, o.id))}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on }}
              style={[
                styles.option,
                {
                  borderColor: on ? theme.colors.accent : theme.colors.border,
                  backgroundColor: on ? theme.colors.statusWarningBg : theme.colors.surface,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <Icon
                name={multi ? (on ? 'check-box' : 'check-box-outline-blank') : on ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={22}
                color={on ? theme.colors.accent : theme.colors.textMuted}
              />
              <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{o.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.navRow}>
        <View style={{ flex: 1 }}>
          {index > 0 ? <Button label="Previous" icon="chevron-left" variant="outline" onPress={() => setIndex((i) => i - 1)} fullWidth /> : null}
        </View>
        <View style={{ flex: 1 }}>
          {last ? (
            <Button label="Submit" loading={submitting} disabled={!allAnswered(answers, quiz.questions)} onPress={() => void onSubmit()} fullWidth />
          ) : (
            <Button label="Next" icon="chevron-right" iconPosition="right" disabled={!isAnswered(answers, question.id)} onPress={() => setIndex((i) => i + 1)} fullWidth />
          )}
        </View>
      </View>
      {last && !allAnswered(answers, quiz.questions) ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, textAlign: 'center' }}>
          Answer every question to submit. Use Previous to go back to one you skipped.
        </Text>
      ) : null}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  navRow: { flexDirection: 'row', gap: 10 },
});
