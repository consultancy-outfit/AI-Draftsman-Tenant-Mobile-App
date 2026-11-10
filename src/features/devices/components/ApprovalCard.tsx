import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { DeviceApproval } from '../devices.types';
import { APPROVAL_WHAT } from '../devicesRules';

interface Props {
  approval: DeviceApproval;
  busy: boolean;
  onDecide: (decision: 'allow' | 'deny') => void;
}

/** "Your computer wants to {what}: {label}" with Allow / Deny under the text. */
export function ApprovalCard({ approval, busy, onDecide }: Props) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.xl }]}>
      <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 14 }}>
        Your computer wants to {APPROVAL_WHAT[approval.kind] ?? APPROVAL_WHAT.other}: {approval.label}
      </Text>
      {approval.detail ? (
        <ScrollView
          style={[styles.detail, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          nestedScrollEnabled
        >
          <Text selectable style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 12 }}>
            {approval.detail}
          </Text>
        </ScrollView>
      ) : null}
      <Button label="Allow" onPress={() => onDecide('allow')} loading={busy} disabled={busy} fullWidth />
      <Button label="Deny" variant="outline" onPress={() => onDecide('deny')} disabled={busy} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, marginHorizontal: 16, marginBottom: 8 },
  detail: { maxHeight: 160, borderWidth: 1, borderRadius: 8, padding: 8 },
});
