import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon, Loader, MarkdownText, PickerField, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { newIdempotencyKey } from '@/utils/ids';
import { KeyboardLift } from '@/utils/KeyboardLift';

import { LEARNING_COPY } from '../learning.data';
import { LEARNING_DISCLAIMER, TUTOR_POLL_INTERVAL_MS, learningErrorCode, shouldPollTutor, tutorPanelState } from '../learning.logic';
import type { TutorMessage, TutorSession } from '../learning.types';
import {
  useCancelTutorTurnMutation,
  useGetTutorMessagesQuery,
  useGetTutorSessionsQuery,
  useSendTutorMessageMutation,
  useStartTutorSessionMutation,
} from '../learningApi';
import { LearningError } from './LearningShared';

interface TutorPanelProps {
  enrollmentId: string;
  /** Only an ACTIVE enrolment may message the tutor or start a session. */
  enrolmentActive: boolean;
  /** The item the next message is about. */
  focusCode: string | undefined;
  onClearFocus: () => void;
  onOpenItem: (code: string) => void;
}

const sessionLabel = (s: TutorSession, i: number) =>
  `Session ${i + 1} · ${new Date(s.lastMessageAt ?? s.startedAt).toLocaleDateString('en-GB')}${s.focusCodes[0] ? ` · ${s.focusCodes[0]}` : ''}${s.status === 'CLOSED' ? ' · closed' : ''}`;

/**
 * The AI tutor chat for one enrolment. A message returns 202 at once and the reply is produced in the
 * background; this panel POLLS (every 2 s) the messages and sessions while the session's active turn is
 * STREAMING, and stops the moment it is not. Every new message has its own Idempotency-Key, kept across
 * retries of THAT message, so a retry after a failure never sends it twice. A 503 TUTOR_UNAVAILABLE means the
 * message was saved but no reply exists — said plainly, with Retry (same key). The learner's own bubble shows
 * at once (optimistic) until the server's copy arrives.
 */
export function TutorPanel({ enrollmentId, enrolmentActive, focusCode, onClearFocus, onOpenItem }: TutorPanelProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(0);
  const sessions = useGetTutorSessionsQuery(enrollmentId, { pollingInterval: pollMs });
  const list = useMemo(() => [...(sessions.data ?? [])].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1)), [sessions.data]);
  /* Default to the newest ACTIVE session (else the newest). */
  useEffect(() => {
    if (sessionId && list.some((s) => s.id === sessionId)) return;
    const newest = [...list].reverse().find((s) => s.status === 'ACTIVE') ?? list[list.length - 1];
    setSessionId(newest?.id ?? null);
  }, [list, sessionId]);
  const session = list.find((s) => s.id === sessionId) ?? null;
  const polling = shouldPollTutor(session);
  useEffect(() => setPollMs(polling ? TUTOR_POLL_INTERVAL_MS : 0), [polling]);

  const messages = useGetTutorMessagesQuery({ enrollmentId, sessionId: sessionId ?? '' }, { skip: !sessionId, pollingInterval: pollMs });
  const [startSession, { isLoading: starting }] = useStartTutorSessionMutation();
  const [send, { isLoading: sending, error: sendError, reset: resetSend }] = useSendTutorMessageMutation();
  const [cancel, { isLoading: cancelling }] = useCancelTutorTurnMutation();

  const [draft, setDraft] = useState('');
  /* The message being sent or last failed, with its key — a retry of the SAME text reuses it. */
  const attempt = useRef<{ text: string; key: string; focus: string | undefined } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const panelState = tutorPanelState({ session, sendError });
  const canMessage = enrolmentActive && Boolean(session) && session?.status === 'ACTIVE' && !polling;

  const submit = async (text: string) => {
    if (!session) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!attempt.current || attempt.current.text !== trimmed || attempt.current.focus !== focusCode) {
      attempt.current = { text: trimmed, key: newIdempotencyKey(), focus: focusCode };
    }
    setPending(trimmed);
    setDraft('');
    resetSend();
    try {
      await send({ enrollmentId, sessionId: session.id, content: trimmed, ...(focusCode ? { focusCode } : {}), idempotencyKey: attempt.current.key }).unwrap();
      attempt.current = null;
      setPollMs(TUTOR_POLL_INTERVAL_MS);
    } catch (err) {
      const code = learningErrorCode(err);
      if (code === 'TUTOR_UNAVAILABLE') {
        /* Saved, no reply: the panel explains and offers Retry with the same key. */
      } else if (code === 'TURN_IN_PROGRESS') {
        toast.show('The tutor is still answering. Wait for the reply, then ask again.', { tone: 'warning' });
        attempt.current = null;
      } else if (code === 'ENROLLMENT_NOT_ACTIVE') {
        toast.show('This course is not active, so the tutor cannot reply.', { tone: 'warning' });
        attempt.current = null;
      } else {
        toast.show(getErrorMessage(err as never, 'Could not send your message.'), { tone: 'error' });
        /* Keep the text so the learner can retry it. */
        setDraft(trimmed);
      }
    } finally {
      setPending(null);
    }
  };

  const start = async () => {
    try {
      const s = await startSession({ enrollmentId, ...(focusCode ? { focusCode } : {}) }).unwrap();
      setSessionId(s.id);
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not start a session.'), { tone: 'error' });
    }
  };

  const stop = async () => {
    if (!session) return;
    try {
      await cancel({ enrollmentId, sessionId: session.id }).unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not stop the reply.'), { tone: 'error' });
    }
  };

  /* Oldest first from the server; the list is inverted, so newest is at the bottom and stays there. */
  const rows = useMemo(() => {
    const out: Array<TutorMessage | { id: string; pending: true; content: string }> = [...(messages.data ?? [])];
    const last = out[out.length - 1];
    if (pending && !(last && 'role' in last && last.role === 'learner' && last.content === pending)) out.push({ id: 'pending', pending: true, content: pending });
    return out.reverse();
  }, [messages.data, pending]);

  if (sessions.isLoading) return <Loader label="Loading your tutor…" />;
  if (sessions.error && !sessions.data) return <LearningError error={sessions.error} onRetry={() => void sessions.refetch()} />;

  const text = (s: string, color: string = theme.colors.textMuted) => <Text style={{ color, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{s}</Text>;

  return (
    <KeyboardLift style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View style={[styles.top, { borderBottomColor: theme.colors.border }]}>
          {list.length > 1 ? (
            <PickerField value={sessionId ?? ''} options={list.map((s, i) => ({ value: s.id, label: sessionLabel(s, i) }))} onChange={setSessionId} />
          ) : null}
          {enrolmentActive ? (
            <Button label={list.length === 0 ? 'Start a session' : 'New session'} icon="add" size="sm" variant={list.length === 0 ? 'primary' : 'outline'} loading={starting} onPress={() => void start()} />
          ) : null}
          {text(LEARNING_DISCLAIMER)}
        </View>

        {!session ? (
          <EmptyState icon="school" title={LEARNING_COPY.tutorName} description={enrolmentActive ? 'Start a session to talk to your AI tutor about this course.' : 'This course is not active, so a new session cannot be started.'} />
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              messages.isLoading ? (
                <Loader label="Loading messages…" />
              ) : (
                <View style={{ transform: [{ scaleY: -1 }] }}>
                  <EmptyState icon="chat" title="Ask your tutor anything" description="Your tutor can explain items, set practice and assess you." />
                </View>
              )
            }
            renderItem={({ item }) => {
              const mine = 'pending' in item || item.role === 'learner';
              const m = 'pending' in item ? null : item;
              return (
                <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                  <View style={[styles.bubble, { backgroundColor: mine ? theme.colors.accent : theme.colors.surface, borderColor: theme.colors.border, borderWidth: mine ? 0 : StyleSheet.hairlineWidth, borderRadius: theme.radii.xl, opacity: 'pending' in item ? 0.7 : 1 }]}>
                    {mine ? (
                      <Text style={{ color: theme.colors.textOnAccent, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{item.content}</Text>
                    ) : (
                      <>
                        {m && m.content ? <MarkdownText content={m.content} /> : null}
                        {m?.status === 'STREAMING' ? (
                          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{m.content ? '▍' : LEARNING_COPY.tutorDrafting}</Text>
                        ) : null}
                        {m?.status === 'FAILED' ? text('The tutor could not finish this reply.', theme.colors.statusErrorFg) : null}
                        {m?.status === 'CANCELLED' ? text('Stopped.') : null}
                        {m && m.agentCodes.length > 0 ? text(`Specialists: ${m.agentCodes.join(', ')}`) : null}
                      </>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {panelState === 'unavailable' && attempt.current ? (
          <View style={[styles.callout, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.lg }]}>
            <Icon name="cloud-off" size={20} color={theme.colors.statusWarningFg} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{LEARNING_COPY.tutorUnavailableTitle}</Text>
              {text(LEARNING_COPY.tutorUnavailableDescription, theme.colors.statusWarningFg)}
              <Button label={LEARNING_COPY.retry} size="sm" variant="outline" loading={sending} onPress={() => void submit(attempt.current?.text ?? '')} />
            </View>
          </View>
        ) : null}

        {session ? (
          <View style={[styles.composer, { borderTopColor: theme.colors.border, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: theme.colors.background }]}>
            {focusCode ? (
              <View style={styles.focusRow}>
                <TouchableOpacity onPress={() => onOpenItem(focusCode)} accessibilityRole="button" style={[styles.focus, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.full }]}>
                  <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                    {LEARNING_COPY.tutorFocus}: {focusCode}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClearFocus} accessibilityRole="button" accessibilityLabel="Clear focus" hitSlop={10}>
                  <Icon name="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={canMessage ? LEARNING_COPY.tutorPlaceholder : polling ? LEARNING_COPY.tutorDrafting : LEARNING_COPY.tutorPlaceholderDisabled}
                  editable={canMessage}
                  multiline
                  maxLength={4000}
                  style={{ maxHeight: 120 }}
                />
              </View>
              {polling ? (
                <Button label="Stop" icon="stop" variant="outline" size="sm" loading={cancelling} onPress={() => void stop()} />
              ) : (
                <Button label="Send" icon="send" size="sm" disabled={!canMessage || !draft.trim()} loading={sending} onPress={() => void submit(draft)} />
              )}
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardLift>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  list: { padding: 16 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, marginHorizontal: 16, marginBottom: 8 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focus: { paddingHorizontal: 12, paddingVertical: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
});
