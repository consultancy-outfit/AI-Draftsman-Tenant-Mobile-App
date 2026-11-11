import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { DesktopRun } from '../devices.types';

const TITLE: Record<DesktopRun['outcome'], string> = {
  completed: 'Ran on this computer',
  stopped: 'Stopped on this computer',
  failed: 'Failed on this computer',
};

/** "Ran on this computer · {path}" plus a "{n} steps" toggle, shown above the desktop's answer. */
export function DesktopRunHeader({ run }: { run: DesktopRun }) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const steps = run.steps ?? [];
  const bad = run.outcome !== 'completed';
  return (
    <View style={[styles.wrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.row}>
        <Icon name="computer" size={15} color={bad ? theme.colors.statusErrorFg : theme.colors.accent} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, flex: 1 }} selectable>
          {TITLE[run.outcome]} · {run.folderName}
        </Text>
      </View>
      {steps.length > 0 && (
        <TouchableOpacity onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.row}>
          <Text style={{ color: theme.colors.accent, fontSize: 12 }}>
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </Text>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={16} color={theme.colors.accent} />
        </TouchableOpacity>
      )}
      {open &&
        steps.map((s, i) => (
          <Text key={i} style={{ color: s.ok ? theme.colors.text : theme.colors.statusErrorFg, fontSize: 12 }} selectable>
            {s.ok ? '✓' : '✗'} {s.label}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 8, gap: 4, alignSelf: 'stretch', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
