import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { COMPETENCY_STATE_LABELS, LEARNING_DISCLAIMER, isProfileIncomplete, progressPercent } from '../learning.logic';
import { LEARNING_COPY } from '../learning.data';
import type { CompetencyState, ProgressSummary } from '../learning.types';

/** A small coloured pill. */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'info' | 'warning' | 'error' }) {
  const { theme } = useAppTheme();
  const bg = {
    neutral: theme.colors.statusNeutralBg,
    success: theme.colors.statusSuccessBg,
    info: theme.colors.statusInfoBg,
    warning: theme.colors.statusWarningBg,
    error: theme.colors.statusErrorBg,
  }[tone];
  const fg = {
    neutral: theme.colors.statusNeutralFg,
    success: theme.colors.statusSuccessFg,
    info: theme.colors.statusInfoFg,
    warning: theme.colors.statusWarningFg,
    error: theme.colors.statusErrorFg,
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderRadius: theme.radii.full }]}>
      <Text style={{ color: fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{label}</Text>
    </View>
  );
}

const STATE_TONE: Record<CompetencyState, 'neutral' | 'info' | 'success'> = { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', DEMONSTRATED: 'success' };

/** The ASSESSED state of one item (never the learner's own confidence). */
export function CompetencyStateTag({ state }: { state: CompetencyState }) {
  return <Pill label={COMPETENCY_STATE_LABELS[state]} tone={STATE_TONE[state]} />;
}

/** Progress bar plus the three counts. */
export function ProgressSummaryView({ progress }: { progress: ProgressSummary }) {
  const { theme } = useAppTheme();
  const percent = progressPercent(progress);
  return (
    <View style={{ gap: 6 }}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.statusNeutralBg, overflow: 'hidden' }}
      >
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: theme.colors.accent }} />
      </View>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
        {percent}% demonstrated · {progress.demonstrated} demonstrated · {progress.inProgress} in progress · {progress.notStarted} not started
      </Text>
    </View>
  );
}

/** Shown on safety-critical occupations. */
export function SafetyNotice({ text }: { text: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.lg }]} accessibilityRole="alert">
      <Icon name="health-and-safety" size={20} color={theme.colors.statusWarningFg} />
      <Text style={{ flex: 1, color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{text}</Text>
    </View>
  );
}

/** "Not a qualification" — shown verbatim wherever progress is shown. */
export function LearningDisclaimer() {
  const { theme } = useAppTheme();
  return <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{LEARNING_DISCLAIMER}</Text>;
}

/**
 * A failed learning load. A 403 PROFILE_INCOMPLETE means this person's learner Profile (which the web
 * portal asks everyone to complete) is missing or out of date; the form is web-only for now, so say so
 * instead of showing a generic error they cannot fix by retrying.
 */
export function LearningError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isProfileIncomplete(error)) {
    return (
      <EmptyState
        icon="person-outline"
        title="Complete your profile first"
        description="Learning needs your learner profile to be up to date. Open the AIDraftsMan web portal, finish the profile, then come back and pull to refresh."
        {...(onRetry ? { actionLabel: LEARNING_COPY.retry, onAction: onRetry } : {})}
      />
    );
  }
  return <ErrorState title={LEARNING_COPY.loadFailedTitle} message={LEARNING_COPY.loadFailedDescription} {...(onRetry ? { onRetry } : {})} />;
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
});
