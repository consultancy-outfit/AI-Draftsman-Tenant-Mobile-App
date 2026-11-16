import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { isTeamThread } from '../teamChatRules';
import { formatMoneyCents, formatRelativeTime } from '@/utils/format';

import type { ChatThread } from '../chat.types';
import { agentDisplayName, hasCost, threadDisplayName } from '../chatRules';

interface ThreadCardProps {
  thread: ChatThread;
  onPress: () => void;
  /** Long-press opens the action sheet. On the web these five actions live
   * behind a hover-revealed kebab, which has no touch equivalent — long
   * press is the established pattern in the old app and costs no chrome. */
  onLongPress: () => void;
  /** Cost is `usage.view`, NOT a chat permission. When the caller cannot see
   * money the figure is absent from the response entirely, and the row must
   * omit the slot rather than render a zero. */
  canViewCost: boolean;
  /** Shown when the thread has no agent (default: an em dash). */
  noAgentLabel?: string;
  /** Selection mode is explicit here rather than hover-revealed. */
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

/**
 * One thread in the list. Read-only, like every other card in this app —
 * tapping opens the conversation, and every write lives on the screen it
 * pushes to or in the long-press sheet.
 *
 * Layout mirrors the web row: a leading tile, the name, a meta line of
 * "{agent} · {when}", and the cost trailing. The pin marker is a small
 * indicator rather than a button — pinning happens in the action sheet, so
 * a tappable-looking pin on the row would be a lie.
 */
export function ThreadCard({
  thread,
  onPress,
  onLongPress,
  canViewCost,
  noAgentLabel = '—',
  selectable,
  selected,
  onToggleSelect,
}: ThreadCardProps) {
  const { theme } = useAppTheme();

  const name = threadDisplayName(thread.title);
  const showCost = canViewCost && hasCost(thread);
  const isArchived = thread.status === 'ARCHIVED';

  // `agentDeleted` is the one condition that makes an otherwise ordinary
  // thread unable to take new messages, and it is worth saying on the row
  // rather than only discovering it at the composer.
  const isTeam = isTeamThread(thread);
  const meta = [
    isTeam ? thread.agentTeamName || 'Team' : thread.agentId ? agentDisplayName(thread.agentName) : noAgentLabel,
    formatRelativeTime(thread.lastActivityAt),
  ].join(' · ');

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={selectable ? onToggleSelect : onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={selectable ? `Select "${name}"` : `Open "${name}"`}
      accessibilityState={selectable ? { selected } : undefined}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderWidth: selected ? theme.borders.interactive : StyleSheet.hairlineWidth,
          borderRadius: theme.radii.xl,
        },
      ]}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: selected ? theme.colors.accent : theme.colors.accent + '1A',
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Icon
          name={selected ? 'check' : isTeam ? 'groups' : thread.agentDeleted ? 'person-off' : 'chat-bubble-outline'}
          size={20}
          color={selected ? theme.colors.textOnAccent : theme.colors.accent}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {thread.pinned && (
            <Icon name="push-pin" size={13} color={theme.colors.textMuted} />
          )}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.colors.text,
              fontFamily: theme.fontFamilies.display.semibold,
              fontSize: theme.fontSizes.md,
            }}
          >
            {name}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textMuted,
            fontFamily: theme.fontFamilies.body.regular,
            fontSize: theme.fontSizes.xs,
            marginTop: 2,
          }}
        >
          {meta}
          {isArchived ? ' · Archived' : ''}
        </Text>

        {thread.lastMessagePreview !== null && thread.lastMessagePreview.length > 0 && (
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.textMuted,
              fontFamily: theme.fontFamilies.body.regular,
              fontSize: theme.fontSizes.sm,
              marginTop: 4,
            }}
          >
            {thread.lastMessagePreview}
          </Text>
        )}
      </View>

      {showCost ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontFamily: theme.fontFamilies.mono.regular,
            fontSize: theme.fontSizes.xs,
            marginLeft: 8,
          }}
        >
          {formatMoneyCents(thread.totalCostCents)}
        </Text>
      ) : (
        <Icon name="chevron-right" size={22} color={theme.colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  tile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
