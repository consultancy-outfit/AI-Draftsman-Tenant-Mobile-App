import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon, MarkdownText } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatMoneyCents } from '@/utils/format';

import type { ChatMessage } from '../chat.types';
import {
  CANCELLED_LABEL,
  CANCELLED_NO_BALANCE_LABEL,
  NOT_RETRYABLE_NOTE,
  isPolicyBlock,
  messageHasCost,
} from '../chatRules';
import { AttachmentTile } from './AttachmentTile';
import { CitationList } from './CitationList';
import { TypingDots } from './TypingDots';

interface MessageBubbleProps {
  message: ChatMessage;
  /** Whether THIS DEVICE is the origin of the turn — deltas are routed only
   * to the originating socket, so a bubble streaming on another device
   * shows the polled "still working" treatment instead of live text. */
  isOwnTurn: boolean;
  canViewCost: boolean;
  onRetry: () => void;
  onCopy: (text: string) => void;
  /** On a team thread: which specialist wrote this reply. Shown above the
   * bubble — on a one-agent thread every reply is the same agent's. */
  authorName?: string | null;
  /** Render the body as markdown (bold, lists, code, tables…). Off by default so the normal chat
   * keeps its plain-text bubbles; Dispatch turns it on for the desktop agent's replies. */
  markdown?: boolean;
  /** Show the time the message was sent (e.g. "11:29 AM") in the row under the bubble. */
  timeLabel?: string;
}

/**
 * One turn. User bubbles align right in the accent colour; assistant
 * bubbles align left on the surface colour with a border — the old app's
 * corner-notch convention (18px radius, 4px on the "speaking" corner) is
 * kept as the one deliberately hardcoded radius pair in the module, same as
 * `CustomerCard`'s hardcoded padding: the token scale doesn't have a
 * 4-vs-18 asymmetric pair and inventing one for a single component isn't
 * worth it.
 *
 * There is no markdown renderer in this app yet (see docs/chat-module-spec.md
 * D-9) — plain text for prose, with a monospaced block for anything the
 * structured `richContent` marks as code. This covers the two things a
 * transcript actually needs to distinguish; a full markdown pass is a later
 * addition, not a blocker for v1.
 */
export function MessageBubble({
  message,
  isOwnTurn,
  canViewCost,
  onRetry,
  onCopy,
  authorName = null,
  markdown = false,
  timeLabel = '',
}: MessageBubbleProps) {
  const { theme } = useAppTheme();
  const isUser = message.role === 'USER';
  const isStreaming = message.status === 'STREAMING';
  const isFailed = message.status === 'FAILED';
  const isCancelled = message.status === 'CANCELLED';

  // A STREAMING row with no body yet is deliberately not rendered as a
  // bubble at all — an empty speech bubble reads as an answer that said
  // nothing. The conversation screen substitutes a TypingDots row for it.
  if (isStreaming && message.body.length === 0 && isOwnTurn) return null;

  const codeParts = extractCodeBlocks(message.richContent);
  const showCost = canViewCost && !isUser && messageHasCost(message);

  return (
    <View style={[styles.outer, isUser ? styles.outerUser : styles.outerAi]}>
      {!isUser && authorName ? (
        <View style={styles.author}>
          <View style={[styles.authorDot, { backgroundColor: theme.colors.accent }]} />
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }} numberOfLines={1}>
            {authorName}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.colors.accent, borderBottomRightRadius: 4 }
            : {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderBottomLeftRadius: 4,
              },
        ]}
      >
        {message.body.length > 0 && markdown && (
          <MarkdownText content={message.body} color={isUser ? theme.colors.textOnAccent : theme.colors.text} />
        )}

        {message.body.length > 0 && !markdown && (
          <Text
            style={{
              color: isUser ? theme.colors.textOnAccent : theme.colors.text,
              fontFamily: theme.fontFamilies.body.regular,
              fontSize: theme.fontSizes.md,
              lineHeight: 22,
            }}
          >
            {message.body}
            {isStreaming && isOwnTurn && message.body.length > 0 && (
              <Text style={{ color: isUser ? theme.colors.textOnAccent : theme.colors.accent }}>▊</Text>
            )}
          </Text>
        )}

        {isStreaming && message.body.length === 0 && !isOwnTurn && (
          // Another device owns this turn — we only learn it finished when
          // `message:complete` broadcasts to the room, so show a working
          // state rather than an empty bubble.
          <TypingDots color={theme.colors.textMuted} />
        )}

        {codeParts.map((code, i) => (
          <CodeBlock key={i} code={code} onCopy={onCopy} />
        ))}

        {message.attachments.length > 0 && (
          <View style={styles.attachments}>
            {message.attachments.map((a) => (
              <AttachmentTile key={a.id} attachment={a} dark={isUser} />
            ))}
          </View>
        )}

        {message.citations.length > 0 && <CitationList citations={message.citations} dark={isUser} />}
      </View>

      <View style={styles.metaRow}>
        {!isUser && message.modelSlug && (
          <View
            style={[
              styles.modelChip,
              { backgroundColor: theme.colors.accent + '16', borderColor: theme.colors.accent + '30' },
            ]}
          >
            <Text
              style={{
                color: theme.colors.accent,
                fontFamily: theme.fontFamilies.body.medium,
                fontSize: 11,
              }}
            >
              {message.modelSlug}
            </Text>
          </View>
        )}

        {message.body.trim().length > 0 && (
          <TouchableOpacity
            onPress={() => onCopy(message.body)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Copy message"
          >
            <Icon name="content-copy" size={14} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}

        {showCost && (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontFamily: theme.fontFamilies.mono.regular,
              fontSize: 11,
            }}
          >
            {formatMoneyCents(message.costCents)}
          </Text>
        )}

        {timeLabel ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11 }}>{timeLabel}</Text>
        ) : null}
      </View>

      {isFailed && (
        <View style={styles.statusBlock}>
          <Text
            style={{
              color: isPolicyBlock(message) ? theme.colors.warning : theme.colors.error,
              fontFamily: theme.fontFamilies.body.regular,
              fontSize: theme.fontSizes.sm,
            }}
          >
            {isPolicyBlock(message)
              ? `Not answered — ${message.errorMessage ?? message.errorCode}`
              : (message.errorMessage ?? message.errorCode ?? 'Something went wrong.')}
          </Text>
          {/* Retry is suppressed for a policy block or an explicit
             non-retryable turn — repeating a blocked turn just gets it
             blocked again. */}
          {!isPolicyBlock(message) && message.retryable !== false && (
            <TouchableOpacity onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry">
              <Text
                style={{
                  color: theme.colors.accent,
                  fontFamily: theme.fontFamilies.body.semibold,
                  fontSize: theme.fontSizes.sm,
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          )}
          {message.retryable === false && !isPolicyBlock(message) && (
            <Text
              style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}
            >
              {NOT_RETRYABLE_NOTE}
            </Text>
          )}
        </View>
      )}

      {isCancelled && (
        <Text
          style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}
        >
          {message.cancelReason === 'insufficient_balance' ? CANCELLED_NO_BALANCE_LABEL : CANCELLED_LABEL}
        </Text>
      )}
    </View>
  );
}

/** `richContent` is a JSON array of `{ kind, text, language? }` blocks per
 * `message:complete`'s payload. Only the `code` kind gets special
 * treatment for now — everything else is already in `body` as plain text. */
function extractCodeBlocks(richContent: Record<string, unknown> | null): Array<{ text: string; language?: string }> {
  if (!richContent || !Array.isArray((richContent as { blocks?: unknown }).blocks)) return [];
  const blocks = (richContent as { blocks: unknown[] }).blocks;
  return blocks
    .filter((b): b is { kind: string; text: string; language?: string } => {
      if (typeof b !== 'object' || b === null) return false;
      const block = b as Record<string, unknown>;
      return block.kind === 'code' && typeof block.text === 'string';
    })
    .map((b) => ({ text: b.text, language: b.language }));
}

function CodeBlock({ code, onCopy }: { code: { text: string; language?: string }; onCopy: (text: string) => void }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.codeBlock,
        { backgroundColor: theme.isDark ? '#2A2118' : '#EDE8E0', borderRadius: theme.radii.md },
      ]}
    >
      <View style={styles.codeHeader}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.mono.regular, fontSize: 11 }}>
          {code.language ?? 'Code'}
        </Text>
        <TouchableOpacity onPress={() => onCopy(code.text)} accessibilityRole="button" accessibilityLabel="Copy code">
          <Icon name="content-copy" size={14} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.mono.regular, fontSize: 13 }}>
        {code.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  author: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, maxWidth: '85%' },
  authorDot: { width: 6, height: 6, borderRadius: 3 },
  outer: { gap: 4, marginBottom: 8, maxWidth: '86%' },
  outerUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  outerAi: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  modelChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  attachments: { gap: 8 },
  statusBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, flexWrap: 'wrap' },
  codeBlock: { padding: 10, gap: 6 },
  codeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
