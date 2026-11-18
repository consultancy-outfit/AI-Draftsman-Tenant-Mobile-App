import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_PROGRESS_STATE_LABELS, coursePercent } from '../aiLearning.logic';
import type { AiCourseSummary } from '../aiLearning.types';
import { ProgressBar } from './ProgressBar';

/** One course in the catalogue: title, summary, size, state and lesson progress. */
export function CourseCard({ course, onPress }: { course: AiCourseSummary; onPress: () => void }) {
  const { theme } = useAppTheme();
  const percent = coursePercent(course);
  const done = course.state === 'COMPLETED';
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel={course.title}>
      <Card style={styles.card}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, lineHeight: 22 }}>
          {course.title}
        </Text>
        {course.summary ? (
          <Text numberOfLines={2} style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
            {course.summary}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
            {[course.level, `${course.lessonCount} lesson${course.lessonCount === 1 ? '' : 's'}`, course.estMinutes ? `${course.estMinutes} min` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: done ? theme.colors.statusSuccessBg : course.state === 'IN_PROGRESS' ? theme.colors.statusInfoBg : theme.colors.statusNeutralBg,
                borderRadius: theme.radii.full,
              },
            ]}
          >
            <Text
              style={{
                color: done ? theme.colors.statusSuccessFg : course.state === 'IN_PROGRESS' ? theme.colors.statusInfoFg : theme.colors.statusNeutralFg,
                fontFamily: theme.fontFamilies.body.semibold,
                fontSize: theme.fontSizes.xs,
              }}
            >
              {AI_PROGRESS_STATE_LABELS[course.state]}
            </Text>
          </View>
        </View>
        <ProgressBar percent={percent} />
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {course.completedLessons}/{course.lessonCount} lessons complete
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 3 },
});
