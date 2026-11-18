import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, MarkdownText, StatusTabs } from '@/components/ui';
import type { AiLearningStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_LEARNING_COPY } from './aiLearning.data';
import {
  AI_GENERATED_LABEL,
  AI_GENERATED_NOTE,
  OFFICIAL_SOURCE_LABEL,
  aiErrorKind,
  categoryLabel,
  relativeTime,
} from './aiLearning.logic';
import { useGetAiUpdateQuery } from './aiLearningApi';
import { UpdateCard } from './components/UpdateCard';

type Nav = NativeStackNavigationProp<AiLearningStackParamList, 'AiUpdateDetail'>;
type Level = 'beginner' | 'developer';

const SAFE_URL = /^https?:\/\//i;

/**
 * One provider update. The provider's own page is the "Official source"; every
 * block under the dashed "AI-generated explanation" frame is AI-written and
 * labelled as such. Opening this screen makes the server record a view and the
 * feed flips the card's unseen dot (see `getAiUpdate` in `aiLearningApi.ts`).
 */
export function AiUpdateDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { updateId } = useRoute<RouteProp<AiLearningStackParamList, 'AiUpdateDetail'>>().params;
  const { data, isLoading, error, refetch } = useGetAiUpdateQuery(updateId);
  const [level, setLevel] = useState<Level>('beginner');

  const back = () => navigation.goBack();
  const label = (text: string) => (
    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm, marginBottom: 4 }}>{text}</Text>
  );

  if (isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <AppHeader title="Update" mode="stack" onBack={back} />
        <Loader label="Loading update…" />
      </View>
    );
  }

  if (error || !data) {
    const notFound = error ? aiErrorKind(error) === 'not_found' : false;
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <AppHeader title="Update" mode="stack" onBack={back} />
        {notFound ? (
          <EmptyState icon="search-off" title={AI_LEARNING_COPY.notFoundTitle} description={AI_LEARNING_COPY.notFoundDescription} />
        ) : (
          <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={() => void refetch()} />
        )}
      </View>
    );
  }

  const { explanation, source } = data;
  const levelText = level === 'beginner' ? explanation.beginner : explanation.developer;
  const sourceUrl = source.url && SAFE_URL.test(source.url) ? source.url : null;
  const hasExplanation = Boolean(
    explanation.summary || explanation.whyItMatters || explanation.whoItAffects || explanation.technicalDetails || explanation.beginner || explanation.developer,
  );
  const now = Date.now();

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader title={data.provider.name} mode="stack" onBack={back} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.providerRow}>
          <View style={[styles.dot, { backgroundColor: data.provider.color || theme.colors.accent }]} />
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
            {data.provider.name} · {categoryLabel(data.category)} · {relativeTime(data.publishedAt, now)}
          </Text>
        </View>

        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl, lineHeight: 30 }}>
          {data.title}
        </Text>

        {sourceUrl ? (
          <Button label={OFFICIAL_SOURCE_LABEL} icon="open-in-new" iconPosition="right" variant="outline" onPress={() => void WebBrowser.openBrowserAsync(sourceUrl)} />
        ) : null}

        {hasExplanation ? (
          <View style={[styles.generated, { borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
            <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {AI_GENERATED_LABEL}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{AI_GENERATED_NOTE}</Text>

            {explanation.summary ? (
              <View>{label('Summary')}<MarkdownText content={explanation.summary} /></View>
            ) : null}
            {explanation.whyItMatters ? (
              <View>{label('Why it matters')}<MarkdownText content={explanation.whyItMatters} /></View>
            ) : null}
            {explanation.whoItAffects ? (
              <View>{label('Who it affects')}<MarkdownText content={explanation.whoItAffects} /></View>
            ) : null}
            {explanation.technicalDetails ? (
              <View>{label('Technical details')}<MarkdownText content={explanation.technicalDetails} /></View>
            ) : null}
            {explanation.beginner || explanation.developer ? (
              <View style={{ gap: 8 }}>
                <StatusTabs
                  tabs={[
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'developer', label: 'Developer' },
                  ]}
                  value={level}
                  onChange={(v) => setLevel(v as Level)}
                />
                {levelText ? <MarkdownText content={levelText} /> : (
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
                    No {level} version of this update yet.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {data.shorts.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Shorts</Text>
            {data.shorts.map((s) => (
              <Button
                key={s.id}
                label={s.title}
                icon="slideshow"
                variant="outline"
                onPress={() => navigation.navigate('AiLearningHome', { tab: 'shorts', shortId: s.id })}
                fullWidth
              />
            ))}
          </View>
        ) : null}

        {data.relatedLessons.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Related lessons</Text>
            {data.relatedLessons.map((l) => (
              <Button
                key={l.id}
                label={`${l.title} · ${l.courseTitle}`}
                icon="school"
                variant="outline"
                onPress={() => navigation.navigate('AiLesson', { lessonId: l.id, title: l.title })}
                fullWidth
              />
            ))}
          </View>
        ) : null}

        {data.related.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Related updates</Text>
            {data.related.map((u) => (
              <UpdateCard key={u.id} update={u} now={now} onPress={() => navigation.push('AiUpdateDetail', { updateId: u.id, title: u.title })} />
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
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  generated: { borderWidth: 1, borderStyle: 'dashed', padding: 14, gap: 12 },
});
