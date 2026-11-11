import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { useGetAgentTeamQuery } from '@/features/agent-teams/agentTeamsApi';
import { AGENT_TEAM_PERMISSIONS, CHAT_PERMISSIONS, USAGE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import type { ChatConversationStackParamList } from '@/navigation/types';
import { newIdempotencyKey } from '@/utils/ids';

import type { ChatMessage } from './chat.types';
import {
  APPROACHING_CAP_NOTE,
  LOADING_TRANSCRIPT_LABEL,
  LOAD_EARLIER_LABEL,
  NO_ACCESS_BODY,
  NO_ACCESS_TITLE,
  NO_MESSAGES_BODY,
  NO_MESSAGES_TITLE,
  SOCKET_DOWN_NOTE,
  SOCKET_DOWN_TITLE,
  SOCKET_RECOVERING_NOTE,
  TRANSCRIPT_ERROR_TITLE,
  agentDisplayName,
  threadDisplayName,
} from './chatRules';
import { ownsTurn, useRetryChatMessageMutation } from './chatApi';
import { useChatConversation } from './useChatConversation';
import { useComposerAttachments } from './useComposerAttachments';
import { Composer } from './components/Composer';
import { MessageBubble } from './components/MessageBubble';
import { SendQueueRail } from './components/SendQueueRail';
import { TypingDots } from './components/TypingDots';
import { SpecialistReplies } from './components/SpecialistReplies';
import { TeamInteractionCard, type InteractionDecision } from './components/TeamInteractionCard';
import { TeamRunBand } from './components/TeamRunBand';
import { INTERACTION_COPY, groupTeamTranscript, isTeamThread, type TeamTranscriptItem } from './teamChatRules';
import { useCancelTeamRunMutation, useResolveTeamInteractionMutation } from './teamRunApi';
import { useTeamRun } from './useTeamRun';

type TranscriptItem = TeamTranscriptItem<ChatMessage>;

type Nav = NativeStackNavigationProp<ChatConversationStackParamList>;
type Rt = RouteProp<ChatConversationStackParamList, 'ChatConversation'>;

/**
 * One conversation. The transcript is an INVERTED FlatList over messages
 * already ordered newest-first by the API — matching the old app's
 * approach exactly, and sidestepping the DOM-only prepend-scroll
 * compensation the web needs (`maintainVisibleContentPosition` is RN's
 * native answer to the same problem, applied below).
 */
export function ChatConversationScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const canView = usePermission(CHAT_PERMISSIONS.VIEW);
  const canSend = usePermission(CHAT_PERMISSIONS.SEND);
  const canViewCost = usePermission(USAGE_PERMISSIONS.VIEW);

  const conversation = useChatConversation(params.conversationId);
  const attachments = useComposerAttachments(params.conversationId);
  const [retryMessage] = useRetryChatMessageMutation();

  const listRef = useRef<FlatList<TranscriptItem>>(null);

  /* ── Team threads ──────────────────────────────────────────────────────
     A thread answered by a team (mode AGENT_TEAM) reads its roster for the
     specialists' names, folds their replies under the final answer, and
     shows the latest run above the composer. A one-agent thread is
     untouched by all of this. */
  const canApprove = usePermission(AGENT_TEAM_PERMISSIONS.APPROVE);
  const canCancelRun = usePermission(AGENT_TEAM_PERMISSIONS.CANCEL);
  const isTeam = isTeamThread(conversation.thread);
  const teamQuery = useGetAgentTeamQuery(conversation.thread?.agentTeamId ?? '', { skip: !isTeam });
  const agentNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const m of teamQuery.data?.specialists ?? []) names[m.agentId] = m.name;
    if (teamQuery.data?.supervisor) names[teamQuery.data.supervisor.agentId] = teamQuery.data.supervisor.name;
    return names;
  }, [teamQuery.data]);
  const newest = conversation.messages[0];
  const turnPending = Boolean(newest && (newest.role === 'USER' || (!newest.agentId && (newest.status === 'PENDING' || newest.status === 'STREAMING'))));
  const teamRun = useTeamRun({ conversationId: params.conversationId, enabled: isTeam, turnPending, agentNames });
  const [cancelRun, { isLoading: isCancellingRun }] = useCancelTeamRunMutation();
  const [resolveInteraction, { isLoading: isResolving }] = useResolveTeamInteractionMutation();
  /* One idempotency key per pause, kept across retries — a double tap on a
     flaky connection resolves it once. */
  const decisionKeys = useRef(new Map<string, string>());

  /* The transcript, newest first for the inverted list. On a team thread the
     grouping runs oldest-first (as web's does) and is then reversed. */
  const items = useMemo<TranscriptItem[]>(() => {
    if (!isTeam) return conversation.messages.map((m) => ({ kind: 'message', key: m.id, message: m }));
    return groupTeamTranscript([...conversation.messages].reverse()).reverse();
  }, [conversation.messages, isTeam]);

  const handleDecide = async (decision: InteractionDecision) => {
    if (!teamRun.runId) return;
    const key = decisionKeys.current.get(decision.interactionId) ?? newIdempotencyKey();
    decisionKeys.current.set(decision.interactionId, key);
    try {
      await resolveInteraction({ ...decision, runId: teamRun.runId, conversationId: params.conversationId, idempotencyKey: key }).unwrap();
    } catch (err) {
      const status = (err as { status?: number | string })?.status;
      toast.show(status === 404 || status === 409 ? INTERACTION_COPY.alreadyMovedOn : INTERACTION_COPY.resolveFailed, { tone: status === 404 || status === 409 ? 'neutral' : 'error' });
    }
  };

  const handleCancelRun = async () => {
    if (!teamRun.runId) return;
    try {
      await cancelRun({ runId: teamRun.runId, conversationId: params.conversationId }).unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not stop the run.'), { tone: 'error' });
    }
  };

  const renderBubble = (message: ChatMessage, authorName?: string | null) => (
    <MessageBubble
      key={message.id}
      message={message}
      isOwnTurn={ownsTurn(message.id)}
      canViewCost={canViewCost}
      onRetry={() => handleRetry(message)}
      onCopy={handleCopy}
      authorName={authorName}
    />
  );

  // D-6: a swipe-back mid-generation would abandon a turn the user is
  // already paying for — Stop is the only cancel path while streaming.
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: !conversation.isStreaming });
  }, [navigation, conversation.isStreaming]);

  useEffect(() => {
    return () => {
      attachments.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thread = conversation.thread;
  const title = threadDisplayName(thread?.title ?? params.title ?? '');

  const handleSend = (body: string) => {
    const attachmentIds = attachments.readyIds();
    conversation.send(body, attachmentIds);
    attachments.clear();
    // The inverted list's `maintainVisibleContentPosition` exists to keep
    // the view stable when OLDER messages load in at the far end (see the
    // FlatList below) — it does that by compensating the scroll offset
    // whenever content shifts near `minIndexForVisible`. A just-sent
    // message is unshifted to index 0, which is exactly the index that
    // compensation watches, so without an explicit scroll here the same
    // machinery that stops history-loading from jumping the view was also
    // fighting the view landing on the message the user just sent — it
    // reads as the list scrolling away rather than settling on it.
    // `requestAnimationFrame` waits for that layout pass so this scroll is
    // the one that wins.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      toast.show('Copied.', { tone: 'success' });
    } catch {
      toast.show('Could not copy — select the text and copy it by hand.', { tone: 'error' });
    }
  };

  const handleRetry = async (message: ChatMessage) => {
    if (message.role === 'USER' || message.isOptimistic) {
      // A failed USER turn is simply re-sent — with the same body and
      // attachments — rather than PATCHed in place.
      conversation.send(message.body, message.attachments.map((a) => a.id));
      return;
    }
    try {
      await retryMessage({
        messageId: message.id,
        conversationId: params.conversationId,
        idempotencyKey: newIdempotencyKey(),
      }).unwrap();
    } catch (err) {
      const status = (err as { status?: number | string })?.status;
      toast.show(
        status === 402
          ? 'That message was not sent: your free allowance and wallet are both empty, or a spend cap would be exceeded.'
          : 'That message could not be sent.',
        { tone: 'error' },
      );
    }
  };

  const handleResolveBlock = () => {
    if (conversation.composerBlock?.action === 'billing') {
      navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);
    } else if (conversation.composerBlock?.action === 'spendLimits') {
      navigation.navigate('ChatThreadDetails', { conversationId: params.conversationId });
    }
  };

  // Defence in depth: navigation into this screen is already gated on
  // `chat.view` from ChatScreen, but a permission can be revoked mid-session
  // (or the screen reached by a stale deep link), so the screen re-checks
  // itself too, matching ChatScreen's own pattern.
  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <EmptyState icon="lock-outline" title={NO_ACCESS_TITLE} description={NO_ACCESS_BODY} />
      </View>
    );
  }

  if (conversation.isThreadLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (conversation.threadError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState
          title={TRANSCRIPT_ERROR_TITLE}
          message={getErrorMessage(conversation.threadError)}
          onRetry={() => undefined}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Android's own `windowSoftInputMode="adjustResize"` (the RN default)
      // already shrinks the window when the keyboard opens, so a second,
      // JS-driven resize here would double-apply the same shift. iOS has no
      // such OS-level behavior — the padding behavior IS what pushes the
      // composer above the keyboard there, which is the only place this
      // screen was missing it.
    >
      <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />

      <View style={styles.subHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {thread?.agentId && (
            <Text numberOfLines={1} style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {agentDisplayName(thread.agentName)}
              {thread.agentVersion !== null ? ` v${thread.agentVersion}` : ''}
            </Text>
          )}
          {isTeam && (
            <View style={styles.teamLine}>
              <Icon name="groups" size={14} color={theme.colors.accent} />
              <Text numberOfLines={1} style={{ color: theme.colors.textMuted, fontSize: 12, flexShrink: 1 }}>
                {thread?.agentTeamName || 'Team'}
                {teamQuery.data ? ` · ${teamQuery.data.specialists.length} agent${teamQuery.data.specialists.length === 1 ? '' : 's'}` : ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ChatThreadDetails', { conversationId: params.conversationId })}
          accessibilityRole="button"
          accessibilityLabel="Thread details"
        >
          <Icon name="info-outline" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {conversation.socketStatus === 'reconnecting' && (
        <Banner tone="info" text={SOCKET_RECOVERING_NOTE} />
      )}
      {conversation.socketStatus === 'error' && (
        <Banner tone="danger" title={SOCKET_DOWN_TITLE} text={SOCKET_DOWN_NOTE} />
      )}
      {conversation.balance?.approaching && <Banner tone="info" text={APPROACHING_CAP_NOTE} />}

      {conversation.isMessagesLoading ? (
        <View style={styles.centerFill}>
          <Loader />
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>{LOADING_TRANSCRIPT_LABEL}</Text>
        </View>
      ) : conversation.messagesError ? (
        <ErrorState
          title={TRANSCRIPT_ERROR_TITLE}
          message={getErrorMessage(conversation.messagesError)}
          onRetry={conversation.refetchMessages}
        />
      ) : items.length === 0 && !conversation.hasMoreMessages ? (
        /* Rendered OUTSIDE the transcript list on purpose. The list is
           `inverted`: React Native flips the whole scroll view and then flips
           each row back — but not `ListEmptyComponent`, which therefore drew
           upside down and mirrored. */
        <View style={styles.emptyFill}>
          <EmptyState icon="chat-bubble-outline" title={NO_MESSAGES_TITLE} description={NO_MESSAGES_BODY} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          inverted
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.transcript}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          renderItem={({ item }) =>
            item.kind === 'message' ? (
              renderBubble(item.message)
            ) : (
              <SpecialistReplies
                state={item.state}
                count={item.messages.length}
                names={item.messages.map((m) => (m.agentId && agentNames[m.agentId]) || 'A specialist')}
              >
                {item.messages.map((m) => renderBubble(m, (m.agentId && agentNames[m.agentId]) || 'Specialist'))}
              </SpecialistReplies>
            )
          }
          ListFooterComponent={
            conversation.hasMoreMessages ? (
              <TouchableOpacity
                onPress={conversation.loadOlderMessages}
                disabled={conversation.isLoadingOlder}
                style={styles.loadEarlier}
              >
                <Text style={{ color: theme.colors.accent, fontSize: 13 }}>
                  {conversation.isLoadingOlder ? 'Loading…' : LOAD_EARLIER_LABEL}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {conversation.typingLabel && (
        <View style={styles.typingRow}>
          <TypingDots showLabel={false} color={theme.colors.textMuted} />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{conversation.typingLabel}</Text>
        </View>
      )}

      {isTeam &&
        teamRun.interactions.map((interaction) => (
          <TeamInteractionCard key={interaction.id} interaction={interaction} canApprove={canApprove} isResolving={isResolving} onDecide={(d) => void handleDecide(d)} />
        ))}

      {isTeam && teamRun.runId && (
        <TeamRunBand
          phase={teamRun.phase}
          isLive={teamRun.isLive}
          rows={teamRun.rows}
          teamSize={teamQuery.data?.specialists.length ?? teamRun.rows.length}
          waitingName={teamRun.rows.find((r) => r.state === 'input')?.agentName ?? null}
          startedAtMs={teamRun.startedAtMs}
          endedAtMs={teamRun.endedAtMs}
          tokensIn={teamRun.tokensIn}
          tokensOut={teamRun.tokensOut}
          canCancel={canCancelRun}
          isCancelling={isCancellingRun}
          onCancel={() => void handleCancelRun()}
        />
      )}

      <SendQueueRail
        queue={conversation.queue}
        holdNote={conversation.composerBlock?.message ?? null}
        onRemove={conversation.removeFromQueue}
      />

      <Composer
        block={canSend ? conversation.composerBlock : { message: 'Your role can read this conversation but not post to it.', isTransient: false, action: null }}
        onResolveBlock={conversation.composerBlock?.action ? handleResolveBlock : null}
        isSending={false}
        isStreaming={conversation.isStreaming}
        canCancel={conversation.canCancel}
        attachments={attachments.items}
        isUploadingAttachment={attachments.isUploading}
        onSend={handleSend}
        onCancel={conversation.cancelStream}
        onTyping={conversation.onTyping}
        onStopTyping={conversation.onStopTyping}
        onPickFiles={attachments.pickFiles}
        onPickPhotos={attachments.pickPhotos}
        onPickVideos={attachments.pickVideos}
        onRemoveAttachment={attachments.remove}
        onRetryAttachment={attachments.retry}
      />
      <View style={{ height: insets.bottom }} />
    </KeyboardAvoidingView>
  );
}

function Banner({ tone, title, text }: { tone: 'info' | 'danger'; title?: string; text: string }) {
  const { theme } = useAppTheme();
  const bg = tone === 'danger' ? theme.colors.statusErrorBg : theme.colors.statusInfoBg;
  const fg = tone === 'danger' ? theme.colors.statusErrorFg : theme.colors.statusInfoFg;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      {title && <Text style={{ color: fg, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>{title}</Text>}
      <Text style={{ color: fg, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyFill: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  transcript: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  loadEarlier: { alignSelf: 'center', paddingVertical: 10 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  banner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 10, gap: 2 },
});
