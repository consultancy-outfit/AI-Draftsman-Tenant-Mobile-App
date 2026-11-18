import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AgentTeamReadiness } from '../agentTeams.types';

/**
 * Shown on a team that cannot run: one or more enabled specialists are not
 * evaluated and published — usually an agent edited after it was published.
 * Each name opens that agent (Company agents), where it is evaluated and
 * published; the team runs again as soon as the last one is.
 */
export function NotReadyBanner({ pending, onOpenAgent }: { pending: AgentTeamReadiness['pendingMembers']; onOpenAgent: (agentId: string) => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.colors.statusErrorBg, borderRadius: theme.radii.lg }]} accessibilityRole="alert">
      <Icon name="error-outline" size={20} color={theme.colors.statusErrorFg} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>This team can&apos;t run yet.</Text>
        <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
          {pending.length === 1 ? 'This specialist needs' : 'These specialists need'} to be evaluated and published first:
        </Text>
        <View style={styles.names}>
          {pending.map((m) => (
            <TouchableOpacity key={m.agentId} onPress={() => onOpenAgent(m.agentId)} accessibilityRole="link" hitSlop={6}>
              <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, textDecorationLine: 'underline' }}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
