import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { TEAM_COPY } from '../teamMarketplace.data';
import type { MarketplaceTeam } from '../teamMarketplace.types';

interface TeamCardProps {
  team: MarketplaceTeam;
  installed: boolean;
  onPress: () => void;
}

/** One team template in the catalogue: name, blurb, agent count, installs, and its state. */
export function TeamCard({ team, installed, onPress }: TeamCardProps) {
  const { theme } = useAppTheme();
  const pill = (label: string, tone: 'success' | 'warning' | 'neutral') => {
    const bg = tone === 'success' ? theme.colors.statusSuccessBg : tone === 'warning' ? theme.colors.statusWarningBg : theme.colors.statusNeutralBg;
    const fg = tone === 'success' ? theme.colors.statusSuccessFg : tone === 'warning' ? theme.colors.statusWarningFg : theme.colors.statusNeutralFg;
    return (
      <View style={[styles.pill, { backgroundColor: bg, borderRadius: theme.radii.full }]}>
        <Text style={{ color: fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{label}</Text>
      </View>
    );
  };
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel={team.name}>
      <Card style={{ gap: 8 }}>
        <View style={styles.top}>
          <View style={[styles.icon, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
            <Icon name="account-tree" size={20} color={theme.colors.accent} />
          </View>
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
            {team.name}
          </Text>
          <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
        </View>
        {team.description ? (
          <Text numberOfLines={3} style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
            {team.description}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {pill(`${team.members.length} agent${team.members.length === 1 ? '' : 's'}`, 'neutral')}
          {team.installCount > 0 ? pill(`${team.installCount} install${team.installCount === 1 ? '' : 's'}`, 'neutral') : null}
          {installed ? pill(TEAM_COPY.installed, 'success') : !team.ready ? pill(TEAM_COPY.notReadyLabel, 'warning') : null}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 3 },
});
