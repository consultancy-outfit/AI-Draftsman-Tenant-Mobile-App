import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import { chatBlockedReason, chatButtonLabel, visiblePurpose, type AgentTeamRow } from '../agentTeamsRules';

interface AgentTeamCardProps {
  row: AgentTeamRow;
  canBuild: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onChat: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

type ActionTone = 'accent' | 'neutral' | 'danger';

function ActionButton({ icon, label, onPress, tone, disabled }: { icon: IconName; label: string; onPress: () => void; tone: ActionTone; disabled?: boolean }) {
  const { theme } = useAppTheme();
  const palette: Record<ActionTone, { fg: string; bg: string; border: string }> = {
    accent: { fg: theme.colors.accent, bg: theme.colors.accent + '12', border: theme.colors.accent + '55' },
    neutral: { fg: theme.colors.text, bg: theme.colors.surface, border: theme.colors.border },
    danger: { fg: theme.colors.error, bg: theme.colors.surface, border: theme.colors.error + '40' },
  };
  const p = palette[tone];
  return (
    /* Never `disabled` on the touchable: a dimmed action still answers a
       tap, with the reason as a toast — mobile's stand-in for web's tooltip
       on a disabled button. */
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.action, { backgroundColor: p.bg, borderColor: p.border, borderRadius: theme.radii.md }, disabled && styles.dimmed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Icon name={icon} size={15} color={p.fg} />
      <Text style={{ color: p.fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * One team — web's `TeamListTable` row, laid out like this app's own
 * Company agents card: identity row, a one-line purpose, a metric strip,
 * then the row's three actions (Chat / Edit / Delete). Tapping the card
 * itself opens the team.
 */
export function AgentTeamCard({ row, canBuild, canDelete, onOpen, onChat, onEdit, onDelete }: AgentTeamCardProps) {
  const { theme } = useAppTheme();
  const purpose = visiblePurpose(row);
  const fromChat = row.origin === 'THREAD';

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${row.name}`}
    >
      <View style={styles.top}>
        <View style={[styles.iconBox, { backgroundColor: fromChat ? theme.colors.statusInfoBg : theme.colors.statusNeutralBg, borderRadius: theme.radii.md }]}>
          <Icon name={fromChat ? 'forum' : 'account-tree'} size={20} color={fromChat ? theme.colors.statusInfoFg : theme.colors.accent} />
        </View>
        <View style={styles.identity}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={2}>
            {row.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
            {fromChat ? 'From a team chat' : 'Built on the Teams page'}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      </View>

      {purpose ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, marginTop: 10, lineHeight: 19 }} numberOfLines={2}>
          {purpose}
        </Text>
      ) : null}

      <View style={[styles.metrics, { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>SPECIALISTS</Text>
          <View style={styles.metricRow}>
            <Icon name="smart-toy" size={14} color={theme.colors.textMuted} />
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>{row.specialistCount}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>REVISION</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>v{row.revision}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>UPDATED</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
            {formatRelativeTime(row.updatedAt)}
          </Text>
        </View>
      </View>

      <View style={styles.chips}>
        {fromChat && (
          <View style={[styles.chip, { borderColor: theme.colors.statusInfoFg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>From chat</Text>
          </View>
        )}
        <View style={[styles.chip, { borderColor: theme.colors.border, borderRadius: theme.radii.full }]}>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>{row.accessLabel}</Text>
        </View>
        {!row.ready && (
          <View style={[styles.chip, { borderColor: theme.colors.statusErrorFg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 11 }}>Not ready</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <ActionButton icon="chat-bubble-outline" label={chatButtonLabel(row.origin)} onPress={onChat} tone="accent" disabled={Boolean(chatBlockedReason(row))} />
        <ActionButton icon="edit" label="Edit" onPress={onEdit} tone="neutral" disabled={!canBuild || !row.canEditTeam} />
        <ActionButton icon="delete-outline" label="Delete" onPress={onDelete} tone="danger" disabled={!canDelete || !row.canDeleteTeam} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  metrics: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12, marginTop: 12 },
  metric: { flex: 1, gap: 3 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricValue: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderWidth: 1 },
  dimmed: { opacity: 0.45 },
});
