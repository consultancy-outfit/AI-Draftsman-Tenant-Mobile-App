import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** A small provider-colour dot before the label. */
  dotColor?: string;
}

/** A filter pill: provider choices and the Important / Unseen toggles. */
export function Chip({ label, selected = false, onPress, dotColor }: ChipProps) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radii.full,
        },
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text
        numberOfLines={1}
        style={{
          color: selected ? theme.colors.textOnAccent : theme.colors.text,
          fontFamily: theme.fontFamilies.body.semibold,
          fontSize: theme.fontSizes.xs,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
