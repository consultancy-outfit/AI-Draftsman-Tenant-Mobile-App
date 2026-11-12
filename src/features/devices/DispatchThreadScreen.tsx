import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { useGetChatMessagesQuery, useGetChatModelsQuery, useGetChatThreadQuery } from '@/features/chat/chatApi';
import type { ChatMessage } from '@/features/chat/chat.types';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { threadDisplayName } from '@/features/chat/chatRules';
import type { ChatConversationStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { api } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { ApprovalCard } from './components/ApprovalCard';
import { DesktopRunHeader, NoStepsWarning, isNoStepsRun } from './components/DesktopRunHeader';
import { TaskCard } from './components/TaskCard';
import {
  isUnpairedError,
  useCancelDeviceTaskMutation,
  useDecideDeviceApprovalMutation,
  useGetDeviceApprovalsQuery,
  useGetDeviceArtifactsQuery,
  useGetDeviceTasksQuery,
  useLazyGetDispatchMessagesPageQuery,
  useSendDeviceTaskMutation,
} from './devicesApi';
import {
  DISPATCH_FOLDER_KEY,
  FOLDER_NOT_ALLOWED_COPY,
  MAX_TASK_CHARS,
  PRESENCE_LABEL,
  computerPresence,
  folderPathProblem,
  getDesktopRun,
  isActiveTask,
  isFolderNotAllowed,
  isRemoteControlOff,
} from './devicesRules';
import { useBackToDispatch } from './useBackToDispatch';
import { usePairedComputer } from './usePairedComputer';

type Nav = NativeStackNavigationProp<ChatConversationStackParamList>;
type Rt = RouteProp<ChatConversationStackParamList, 'DispatchThread'>;

const TASK_POLL_MS = 3000;
const MESSAGES_POLL_MS = 5000;

/**
 * One Dispatch thread. Work goes ONLY through POST /devices/tasks (never
 * POST /conversations/{id}/messages: that answers 409). The computer writes
 * its answer into the thread, so messages are polled while a task is active.
 */
/** Keyed by thread: opening another thread (the route is reused with new params)
 * starts from clean state, so drafts, folder and progress never leak across threads. */
export function DispatchThreadScreen() {
  const { params } = useRoute<Rt>();
  return <DispatchThread key={params.conversationId} />;
}

function DispatchThread() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const conversationId = params.conversationId;
  const goBack = useBackToDispatch();
  const isFocused = useIsFocused();

  const { paired } = usePairedComputer({ pollMs: 30000 });
  const computerKeyId = paired?.computer.id ?? '';
  const hasAnyFolder = paired?.phone.scopes.includes('any_folder') ?? false;

  const threadQuery = useGetChatThreadQuery(conversationId);
  const thread = threadQuery.data;
  const isAgent = !!thread?.agentId;
  const modelsQuery = useGetChatModelsQuery(conversationId, { skip: !thread || isAgent });
  const target = !thread ? null : isAgent ? `agent:${thread.agentId}` : modelsQuery.data?.selectedModelSlug ?? null;

  const tasks = useGetDeviceTasksQuery({ conversationId }, { skip: !paired });
  const anyActive = (tasks.data ?? []).some(isActiveTask);
  useEffect(() => {
    if (!anyActive || !isFocused) return;
    const id = setInterval(() => void tasks.refetch(), TASK_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyActive, isFocused]);

  const messages = useGetChatMessagesQuery({ conversationId }, { pollingInterval: isFocused ? MESSAGES_POLL_MS : 0 });
  /* Older pages (kept here: the polled head is replaced on every refresh). */
  const [older, setOlder] = useState<{ items: ChatMessage[]; cursor: string | null; hasMore: boolean } | null>(null);
  const [fetchPage, pageState] = useLazyGetDispatchMessagesPageQuery();
  const headIds = useMemo(() => new Set((messages.data?.items ?? []).map((m) => m.id)), [messages.data]);
  const allMessages = useMemo(
    () => [...(messages.data?.items ?? []), ...(older?.items ?? []).filter((m) => !headIds.has(m.id))],
    [messages.data, older, headIds],
  );
  const nextCursor = older ? older.cursor : messages.data?.nextCursor ?? null;
  const hasEarlier = older ? older.hasMore : messages.data?.hasMore ?? false;
  const loadEarlier = async () => {
    if (!nextCursor || pageState.isFetching) return;
    try {
      const page = await fetchPage({ conversationId, cursor: nextCursor }).unwrap();
      setOlder((prev) => ({ items: [...(prev?.items ?? []), ...page.items], cursor: page.nextCursor, hasMore: page.hasMore }));
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not load earlier messages.'), { tone: 'error' });
    }
  };

  const approvals = useGetDeviceApprovalsQuery({ conversationId }, { skip: !paired || !anyActive, pollingInterval: anyActive && isFocused ? TASK_POLL_MS : 0 });
  const artifacts = useGetDeviceArtifactsQuery({ conversationId, computerKeyId }, { skip: !paired });
  const latestArtifacts = useMemo(() => {
    const byName = new Map<string, NonNullable<typeof artifacts.data>[number]>();
    for (const a of artifacts.data ?? []) {
      const cur = byName.get(a.filename);
      if (!cur || a.version > cur.version) byName.set(a.filename, a);
    }
    return [...byName.values()];
  }, [artifacts.data]);

  /* A task finishing: reload the transcript and the published files. */
  const doneIds = (tasks.data ?? []).filter((t) => t.status === 'DONE' || t.status === 'FAILED').map((t) => t.id).join('|');
  const seenDone = useRef<string | null>(null);
  useEffect(() => {
    if (seenDone.current === null) {
      seenDone.current = doneIds;
      return;
    }
    if (doneIds !== seenDone.current) {
      seenDone.current = doneIds;
      void messages.refetch();
      void artifacts.refetch();
      void threadQuery.refetch(); /* the server names an untitled thread from its first message */
      dispatch(api.util.invalidateTags(['DispatchThread']));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds]);

  const [text, setText] = useState('');
  const [folder, setFolder] = useState('');
  const [folderOpen, setFolderOpen] = useState(false);
  /* The last folder used in this thread is remembered. */
  useEffect(() => {
    AsyncStorage.getItem(DISPATCH_FOLDER_KEY(conversationId))
      .then((v) => {
        if (v) {
          setFolder(v);
          setFolderOpen(true);
        }
      })
      .catch(() => undefined);
  }, [conversationId]);

  const [send, sendState] = useSendDeviceTaskMutation();
  const [cancel, cancelState] = useCancelDeviceTaskMutation();
  const [decide, decideState] = useDecideDeviceApprovalMutation();

  const folderTrim = folder.trim();
  const folderProblem = folderPathProblem(folderTrim);
  const trimmed = text.trim();
  const canSend = !!paired && !!trimmed && trimmed.length <= MAX_TASK_CHARS && !!target && !folderProblem && !sendState.isLoading;

  const handleSend = async () => {
    if (!canSend || !target || !thread) return;
    const input = {
      computerKeyId,
      conversationId,
      text: trimmed,
      target,
      agentName: isAgent ? thread.agentName ?? undefined : undefined,
      folderPath: folderTrim || undefined,
    };
    try {
      try {
        await send(input).unwrap();
      } catch (first) {
        /* 429: wait as told, then try ONCE more (never loop). */
        const f = first as { status?: number | string; retryAfterSeconds?: number };
        if (f.status !== 429) throw first;
        const waitS = f.retryAfterSeconds ?? 3;
        if (waitS > 15) {
          /* A long limit (minutes) is not worth waiting for on screen: say so instead. */
          const mins = Math.ceil(waitS / 60);
          toast.show(`Too many sends. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`, { tone: 'neutral' });
          return;
        }
        await new Promise((r) => setTimeout(r, Math.max(waitS, 1) * 1000));
        await send(input).unwrap();
      }
      setText('');
      setFolderOpen(false);
      AsyncStorage.setItem(DISPATCH_FOLDER_KEY(conversationId), folderTrim).catch(() => undefined);
      void messages.refetch();
    } catch (err) {
      const e = err as { status?: number | string; messages?: string[] };
      if (isUnpairedError(err)) {
        toast.show('This phone is no longer paired. Pair it again to continue.', { tone: 'error' });
        dispatch(api.util.invalidateTags(['DeviceList']));
      } else if (e.status === 403 && isFolderNotAllowed(e.messages ?? [])) {
        toast.show(e.messages?.[0] || FOLDER_NOT_ALLOWED_COPY, { tone: 'error' });
      } else if (e.status === 429) {
        toast.show('Too many requests. Wait a moment and try again.', { tone: 'neutral' });
      } else {
        toast.show(getErrorMessage(err as never, 'Could not send that to your computer.'), { tone: 'error' });
      }
    }
  };

  const handleDecide = async (approvalId: string, decision: 'allow' | 'deny') => {
    try {
      await decide({ approvalId, computerKeyId, decision }).unwrap();
    } catch (err) {
      const status = (err as { status?: number | string })?.status;
      if (status === 409 || status === 404) toast.show('Already answered on the computer, or the time ran out: nothing was allowed.', { tone: 'neutral' });
      else if (status === 429) toast.show('Too many requests. Wait a moment and try again.', { tone: 'neutral' });
      else toast.show(getErrorMessage(err as never, 'Could not send your answer.'), { tone: 'error' });
      void approvals.refetch();
    }
  };

  const handleCopy = async (t: string) => {
    try {
      await Clipboard.setStringAsync(t);
      toast.show('Copied.', { tone: 'success' });
    } catch {
      toast.show('Could not copy.', { tone: 'error' });
    }
  };

  const title = threadDisplayName(thread?.title ?? params.title ?? '');
  const items = allMessages;
  const taskErr = tasks.error as { status?: number; messages?: string[] } | undefined;
  const remoteOff = taskErr?.status === 403 && isRemoteControlOff(taskErr.messages ?? []);
  const presence = paired ? computerPresence(paired.computer.lastSeenAt) : 'offline';

  const notice = !paired
    ? { text: 'This phone is not paired with a computer.', action: 'Pair', onPress: () => navigation.navigate('PairComputer') }
    : remoteOff
      ? { text: 'Remote control is switched off for this workspace.' }
      : presence !== 'online'
        ? { text: 'Your computer looks offline. Work you send waits until it is on and signed in.' }
        : null;

  const renderMessage = (m: ChatMessage) => {
    const run = m.providerServed === 'desktop' ? getDesktopRun(m.richContent) : null;
    return (
      <View key={m.id}>
        {run ? <DesktopRunHeader run={run} /> : null}
        <MessageBubble message={m} isOwnTurn={false} canViewCost={false} onRetry={() => undefined} onCopy={handleCopy} />
        {isNoStepsRun(run) ? <NoStepsWarning /> : null}
      </View>
    );
  };

  const hasWork = (anyActive || (tasks.data ?? []).length > 0 || latestArtifacts.length > 0 || (approvals.data ?? []).length > 0);
  const workCards = hasWork ? (
    <View style={{ gap: 8, paddingVertical: 8 }}>
              {(approvals.data ?? []).map((a) => (
                <ApprovalCard key={a.id} approval={a} busy={decideState.isLoading} onDecide={(d) => void handleDecide(a.id, d)} />
              ))}
              {(tasks.data ?? []).slice(0, anyActive ? 3 : 1).map((t) => (
                <TaskCard key={t.id} task={t} cancelling={cancelState.isLoading} onCancel={() => void cancel({ taskId: t.id }).unwrap().catch(() => void tasks.refetch())} />
              ))}
              {latestArtifacts.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>From your computer</Text>
                  {latestArtifacts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => navigation.navigate('DeviceArtifact', { artifactId: a.id, computerKeyId })}
                      style={[styles.artifact, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${a.title}`}
                    >
                      <Icon name="description" size={18} color={theme.colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: 13 }}>{a.title}</Text>
                        <Text numberOfLines={1} style={{ color: theme.colors.textMuted, fontSize: 11 }}>{a.filename}</Text>
                      </View>
                      <Text style={{ color: theme.colors.accent, fontSize: 12 }}>Open</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
  ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} mode="stack" onBack={goBack} />

      <View style={styles.subHeader}>
        <Icon name="computer" size={15} color={theme.colors.accent} />
        <Text numberOfLines={1} style={{ color: theme.colors.textMuted, fontSize: 12, flex: 1 }}>
          {thread?.agentName ? `${thread.agentName} · ` : ''}
          {paired ? `${paired.computer.name} · ${PRESENCE_LABEL[presence]}` : 'No computer paired'}
        </Text>
      </View>

      {notice && (
        <View style={[styles.notice, { backgroundColor: theme.colors.statusWarningBg }]}>
          <Text style={{ color: theme.colors.statusWarningFg, fontSize: 12, flex: 1 }}>{notice.text}</Text>
          {'action' in notice && notice.action ? (
            <TouchableOpacity onPress={notice.onPress} accessibilityRole="button">
              <Text style={{ color: theme.colors.accent, fontSize: 13 }}>{notice.action}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {messages.isLoading || threadQuery.isLoading ? (
        <View style={styles.center}>
          <Loader />
        </View>
      ) : messages.error ? (
        <ErrorState title="Could not load this thread" message={getErrorMessage(messages.error)} onRetry={messages.refetch} />
      ) : items.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} keyboardShouldPersistTaps="handled">
          <EmptyState icon="computer" title="Nothing here yet" description="Say what your computer should do. Name a folder below, or write the path in your message." />
          {workCards}
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.transcript}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={workCards}
          ListFooterComponent={
            hasEarlier ? (
              <TouchableOpacity onPress={() => void loadEarlier()} disabled={pageState.isFetching} style={styles.loadEarlier} accessibilityRole="button">
                <Text style={{ color: theme.colors.accent, fontSize: 13 }}>{pageState.isFetching ? 'Loading…' : 'Load earlier messages'}</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => renderMessage(item)}
        />
      )}

      <View style={[styles.composer, { borderColor: theme.colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity onPress={() => setFolderOpen((v) => !v)} style={styles.folderToggle} accessibilityRole="button" accessibilityState={{ expanded: folderOpen }}>
          <Icon name="folder-open" size={16} color={theme.colors.accent} />
          <Text numberOfLines={1} style={{ color: theme.colors.accent, fontSize: 12, flex: 1 }}>
            {folderTrim ? `Folder: ${folderTrim}` : 'Name a folder (optional)'}
          </Text>
          <Icon name={folderOpen ? 'expand-less' : 'expand-more'} size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
        {folderOpen && (
          <View style={{ gap: 4 }}>
            <TextInput
              value={folder}
              onChangeText={setFolder}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={500}
              placeholder="D:\Projects\sales  or  /home/me/work"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, { color: theme.colors.text, borderColor: folderProblem ? theme.colors.statusErrorFg : theme.colors.border, backgroundColor: theme.colors.surface, minHeight: 0 }]}
            />
            {folderProblem ? <Text style={{ color: theme.colors.statusErrorFg, fontSize: 12 }}>{folderProblem}</Text> : null}
            {folderTrim && paired && !hasAnyFolder ? (
              <Text style={{ color: theme.colors.statusWarningFg, fontSize: 12 }}>{FOLDER_NOT_ALLOWED_COPY}</Text>
            ) : null}
          </View>
        )}
        <View style={styles.sendRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_TASK_CHARS}
            placeholder={folderTrim ? 'What should your computer do in this folder?' : 'What should your computer do? Write the path here if needed.'}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { flex: 1, color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          />
          <TouchableOpacity
            onPress={() => void handleSend()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send to my computer"
            style={[styles.sendBtn, { backgroundColor: canSend ? theme.colors.accent : theme.colors.border }]}
          >
            <Icon name="send" size={20} color={theme.colors.textOnAccent} />
          </TouchableOpacity>
        </View>
        {!target && thread && !isAgent ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Loading this thread's model…</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  notice: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyScroll: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  loadEarlier: { alignSelf: 'center', paddingVertical: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  transcript: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  artifact: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  folderToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  sendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, maxHeight: 120, fontSize: 14, textAlignVertical: 'top' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
