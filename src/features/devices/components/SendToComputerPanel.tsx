import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Button, Icon, useToast } from '@/components/ui';
import { useGetChatModelsQuery } from '@/features/chat/chatApi';
import type { ChatThread } from '@/features/chat/chat.types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import {
  isUnpairedError,
  useCancelDeviceTaskMutation,
  useDecideDeviceApprovalMutation,
  useGetDeviceApprovalsQuery,
  useGetDeviceArtifactsQuery,
  useGetDeviceTasksQuery,
  useSendDeviceTaskMutation,
} from '../devicesApi';
import { MAX_TASK_CHARS, POLL_MS, PRESENCE_LABEL, computerPresence, isActiveTask } from '../devicesRules';
import { usePairedComputer } from '../usePairedComputer';
import { api } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { ApprovalCard } from './ApprovalCard';
import { TaskCard } from './TaskCard';

interface Props {
  thread: ChatThread;
  onPair: () => void;
  onOpenArtifact: (artifactId: string, computerKeyId: string) => void;
  /** Called when a task flips to DONE so the transcript reloads the desktop's answer. */
  onTaskDone: () => void;
}

/**
 * "Send to my computer" — only for a single-agent or model conversation
 * (never a team thread; the caller decides). Polls only while something is
 * pending, per the handoff's rules.
 */
export function SendToComputerPanel({ thread, onPair, onOpenArtifact, onTaskDone }: Props) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const { paired } = usePairedComputer({ pollMs: open ? 30000 : 0 });
  const computerKeyId = paired?.computer.id ?? '';
  const conversationId = thread.id;

  const isAgent = !!thread.agentId;
  const modelsQuery = useGetChatModelsQuery(conversationId, { skip: isAgent || !paired });
  const target = isAgent ? `agent:${thread.agentId}` : modelsQuery.data?.selectedModelSlug ?? null;

  const tasks = useGetDeviceTasksQuery({ conversationId }, { skip: !paired });
  const anyActive = (tasks.data ?? []).some(isActiveTask);
  /* Poll only while there is something to wait for. */
  useEffect(() => {
    if (!anyActive) return;
    const id = setInterval(() => void tasks.refetch(), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyActive]);

  const approvals = useGetDeviceApprovalsQuery({ conversationId }, { skip: !paired || !anyActive });
  useEffect(() => {
    if (!anyActive) return;
    const id = setInterval(() => void approvals.refetch(), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyActive]);

  const artifacts = useGetDeviceArtifactsQuery({ conversationId, computerKeyId }, { skip: !paired });
  const latestArtifacts = useMemo(() => {
    const byName = new Map<string, NonNullable<typeof artifacts.data>[number]>();
    for (const a of artifacts.data ?? []) {
      const cur = byName.get(a.filename);
      if (!cur || a.version > cur.version) byName.set(a.filename, a);
    }
    return [...byName.values()];
  }, [artifacts.data]);

  /* A task finishing: reload the transcript (the answer is already written
     into the conversation) and the published files. */
  const doneIds = (tasks.data ?? []).filter((t) => t.status === 'DONE').map((t) => t.id).join('|');
  const [seenDone, setSeenDone] = useState<string | null>(null);
  useEffect(() => {
    if (seenDone === null) {
      setSeenDone(doneIds);
      return;
    }
    if (doneIds !== seenDone) {
      setSeenDone(doneIds);
      onTaskDone();
      void artifacts.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds]);

  const [send, sendState] = useSendDeviceTaskMutation();
  const [cancel, cancelState] = useCancelDeviceTaskMutation();
  const [decide, decideState] = useDecideDeviceApprovalMutation();

  if (!paired) {
    return (
      <View style={[styles.wrap, { borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onPair} style={styles.row} accessibilityRole="button" accessibilityLabel="Pair a computer">
          <Icon name="computer" size={18} color={theme.colors.accent} />
          <Text style={{ color: theme.colors.accent, fontSize: 13, flex: 1 }}>Pair your computer to send it work</Text>
          <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  const presence = computerPresence(paired.computer.lastSeenAt);
  const trimmed = text.trim();
  const canSend = !!trimmed && trimmed.length <= MAX_TASK_CHARS && !!target && !sendState.isLoading;

  const handleSend = async () => {
    if (!canSend || !target) return;
    try {
      await send({
        computerKeyId,
        conversationId,
        text: trimmed,
        target,
        agentName: isAgent ? thread.agentName ?? undefined : undefined,
      }).unwrap();
      setText('');
    } catch (err) {
      const status = (err as { status?: number | string })?.status;
      if (isUnpairedError(err)) {
        toast.show('This phone is no longer paired. Pair it again to continue.', { tone: 'error' });
        dispatch(api.util.invalidateTags(['DeviceList']));
      } else if (status === 429) {
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
      if (status === 409 || status === 404) {
        toast.show('Already answered on the computer, or the time ran out: nothing was allowed.', { tone: 'neutral' });
      } else if (status === 429) {
        toast.show('Too many requests. Wait a moment and try again.', { tone: 'neutral' });
      } else {
        toast.show(getErrorMessage(err as never, 'Could not send your answer.'), { tone: 'error' });
      }
      void approvals.refetch();
    }
  };

  const presenceColor = presence === 'online' ? theme.colors.success : presence === 'recent' ? theme.colors.warning : theme.colors.textMuted;

  return (
    <View style={[styles.wrap, { borderColor: theme.colors.border }]}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} style={styles.row} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Icon name="computer" size={18} color={theme.colors.accent} />
        <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: 13, flex: 1 }}>
          Send to my computer · {paired.computer.name}
        </Text>
        <View style={[styles.dot, { backgroundColor: presenceColor }]} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{PRESENCE_LABEL[presence]}</Text>
        <Icon name={open ? 'expand-less' : 'expand-more'} size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {(open || anyActive) && (
        <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
          {open && (
            <View style={{ gap: 8 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX_TASK_CHARS}
                placeholder="What should your computer do?"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              />
              {!target && !isAgent && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Loading this conversation's model…</Text>}
              <Button label="Send to my computer" onPress={() => void handleSend()} loading={sendState.isLoading} disabled={!canSend} fullWidth />
            </View>
          )}

          {(approvals.data ?? []).map((a) => (
            <ApprovalCard key={a.id} approval={a} busy={decideState.isLoading} onDecide={(d) => void handleDecide(a.id, d)} />
          ))}

          {(tasks.data ?? []).slice(0, open ? 5 : 1).map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              cancelling={cancelState.isLoading}
              onCancel={() => void cancel({ taskId: t.id }).unwrap().catch(() => void tasks.refetch())}
            />
          ))}

          {open && latestArtifacts.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>From your computer</Text>
              {latestArtifacts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => onOpenArtifact(a.id, computerKeyId)}
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 70, maxHeight: 140, textAlignVertical: 'top', fontSize: 14 },
  artifact: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
});
