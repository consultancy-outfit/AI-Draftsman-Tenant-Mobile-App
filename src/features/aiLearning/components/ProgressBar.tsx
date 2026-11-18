import { View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

/** A thin determinate bar; `percent` is 0–100. */
export function ProgressBar({ percent }: { percent: number }) {
  const { theme } = useAppTheme();
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.statusNeutralBg, overflow: 'hidden' }}
    >
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: theme.colors.accent }} />
    </View>
  );
}
