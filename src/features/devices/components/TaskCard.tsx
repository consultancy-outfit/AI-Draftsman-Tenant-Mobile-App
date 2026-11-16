import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { DeviceTask } from '../devices.types';
import { VISIBLE_STEPS, isStaleProgress, taskStatusText } from '../devicesRules';

interface Props {
  task: DeviceTask;
  onCancel: () => void;
  cancelling: boolean;
  /** A desktop answer newer than this task is already in the thread. */
  answerInThread?: boolean;
}

const NOT_SAVED = /answer was not saved/i;

export function TaskCard({ task, onCancel, cancelling, answerInThread = false }: Props) {
  const { theme } = useAppTheme();
  /* Re-evaluate staleness without waiting for the next poll. */
  const [, tick] = useState(0);
  useEffect(() => {
    if (task.status !== 'CLAIMED') return;
    const id = setInterval(() => tick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, [task.status]);

  /* The thread is the truth: a late save can leave the task FAILED while the answer IS there. */
  const savedLate = task.status === 'FAILED' && answerInThread && NOT_SAVED.test(task.message ?? '');
  const sendAgain =
    !savedLate &&
    (task.status === 'EXPIRED' || (task.status === 'FAILED' && (!task.message || /stopped|closed|restart|did not finish/i.test(task.message))));

  const tone =
    savedLate
      ? { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg }
      : task.status === 'DONE'
      ? { bg: theme.colors.statusSuccessBg, fg: theme.colors.statusSuccessFg }
      : task.status === 'FAILED' || task.status === 'EXPIRED'
        ? { bg: theme.colors.statusErrorBg, fg: theme.colors.statusErrorFg }
        : task.status === 'CANCELLED'
          ? { bg: theme.colors.statusNeutralBg, fg: theme.colors.statusNeutralFg }
          : { bg: theme.colors.statusInfoBg, fg: theme.colors.statusInfoFg };
  const steps = (task.progress?.steps ?? []).slice(-VISIBLE_STEPS);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
      <View style={[styles.chip, { backgroundColor: tone.bg }]}>
        <Text style={{ color: tone.fg, fontSize: 12, fontFamily: theme.fontFamilies.body.semibold }}>{savedLate ? 'The computer finished. The answer is in the thread.' : taskStatusText(task)}</Text>
      </View>
      {task.status === 'CLAIMED' &&
        steps.map((s, i) => (
          <View key={`${i}-${s.label}`} style={styles.step}>
            {s.state === 'running' ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <Icon name={s.state === 'done' ? 'check' : 'close'} size={16} color={s.state === 'done' ? theme.colors.success : theme.colors.error} />
            )}
            <Text numberOfLines={2} style={{ color: theme.colors.text, fontSize: 13, flex: 1 }}>
              {s.label}
            </Text>
          </View>
        ))}
      {isStaleProgress(task) && (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          No news from your computer. It may be busy or asleep. If the app on the computer was closed, send it again.
        </Text>
      )}
      {sendAgain && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>The computer stopped. Send it again.</Text>}
      {task.status === 'QUEUED' && <Button label="Cancel" variant="outline" size="sm" onPress={onCancel} loading={cancelling} disabled={cancelling} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 12, gap: 8 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
