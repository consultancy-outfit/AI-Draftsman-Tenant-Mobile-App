import { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { ThreadCard } from '@/features/chat/components/ThreadCard';
import type { ChatThread } from '@/features/chat/chat.types';
import { threadDisplayName } from '@/features/chat/chatRules';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { NewDispatchThreadSheet } from './components/NewDispatchThreadSheet';
import { useDeleteDispatchThreadMutation, useGetDispatchThreadsQuery, useRenameDispatchThreadMutation } from './devicesApi';
import { PRESENCE_LABEL, SCOPE_LABEL, computerPresence, isRemoteControlOff } from './devicesRules';
import { usePairedComputer } from './usePairedComputer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-navigator jump (see ChatScreen)
const toRoot = (navigation: any, screen: string, params?: object) =>
  navigation.getParent()?.getParent()?.navigate('ChatConversationStack' as never, { screen, params } as never);

/** The Dispatch tab: an intro when this phone is not paired, otherwise Dispatch's own thread list. */
export function DispatchHomeScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { paired, isLoading: pairedLoading, error: devicesError, refetch: refetchDevices } = usePairedComputer({ pollMs: 30000 });
  const threads = useGetDispatchThreadsQuery(undefined, { skip: !paired });
  const [newOpen, setNewOpen] = useState(false);
  const [actions, setActions] = useState<ChatThread | null>(null);
  const [renaming, setRenaming] = useState<ChatThread | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [rename] = useRenameDispatchThreadMutation();
  const [remove] = useDeleteDispatchThreadMutation();

  const header = <AppHeader title="Dispatch" mode="tab" onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} />;

  if (pairedLoading && !paired) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {header}
        <Loader fullScreen />
      </View>
    );
  }

  if (!paired) {
    const remoteOff = isRemoteControlOff((devicesError as { messages?: string[] } | undefined)?.messages ?? []);
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {header}
        <View style={[styles.intro, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.badge, { backgroundColor: theme.colors.statusInfoBg }]}>
            <Icon name="computer" size={36} color={theme.colors.accent} />
          </View>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: 22, textAlign: 'center' }}>Dispatch</Text>
          <Text style={[styles.introText, { color: theme.colors.textMuted }]}>
            Your phone is like a walkie-talkie for your computer. Name a folder, or write the path in your message, and say what to do. The answer comes back to the same thread.
          </Text>
          <Text style={[styles.introText, { color: theme.colors.textMuted }]}>Keep the computer on and signed in.</Text>
          {remoteOff && (
            <Text style={[styles.introText, { color: theme.colors.statusErrorFg }]}>Remote control is switched off for this workspace.</Text>
          )}
          <Button label="Get started" onPress={() => toRoot(navigation, 'PairComputer')} />
        </View>
      </View>
    );
  }

  const presence = computerPresence(paired.computer.lastSeenAt);
  const items = threads.data?.items ?? [];
  const openThread = (t: ChatThread) => toRoot(navigation, 'DispatchThread', { conversationId: t.id, title: threadDisplayName(t.title) });

  const confirmDelete = (t: ChatThread) =>
    Alert.alert('Delete this thread?', `"${threadDisplayName(t.title)}" and its messages will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void remove({ id: t.id }).unwrap().catch((e) => toast.show(getErrorMessage(e as never, 'Could not delete the thread.'), { tone: 'error' })),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={threads.isFetching && !threads.isLoading}
            onRefresh={() => {
              void threads.refetch();
              void refetchDevices();
            }}
            tintColor={theme.colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 8 }}>
            <View style={styles.row}>
              <Icon name="computer" size={18} color={theme.colors.accent} />
              <Text numberOfLines={1} style={{ color: theme.colors.text, flex: 1, fontSize: 14 }}>{paired.computer.name}</Text>
              <View style={[styles.dot, { backgroundColor: presence === 'online' ? theme.colors.success : presence === 'recent' ? theme.colors.warning : theme.colors.textMuted }]} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{PRESENCE_LABEL[presence]}</Text>
            </View>
            {presence !== 'online' && (
              <Text style={{ color: theme.colors.statusWarningFg, fontSize: 12 }}>
                Your computer looks offline. Work you send waits until it is on and signed in.
              </Text>
            )}
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              This phone may: {paired.phone.scopes.map((s) => SCOPE_LABEL[s] ?? s).join(', ') || 'nothing yet'}
            </Text>
            <View style={[styles.row, { gap: 16 }]}>
              <Button label="New thread" icon="add" size="sm" onPress={() => setNewOpen(true)} />
              <TouchableOpacity onPress={() => toRoot(navigation, 'PairComputer')} accessibilityRole="button" style={{ paddingVertical: 6 }}>
                <Text style={{ color: theme.colors.accent, fontSize: 13 }}>Pair again</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ThreadCard
            thread={item}
            onPress={() => openThread(item)}
            onLongPress={() => setActions(item)}
            canViewCost={false}
            selectable={false}
            selected={false}
            onToggleSelect={() => undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          threads.isLoading ? (
            <Loader />
          ) : threads.error ? (
            <ErrorState title="Could not load threads" message={getErrorMessage(threads.error)} onRetry={threads.refetch} />
          ) : (
            <EmptyState icon="computer" title="No Dispatch threads yet" description="Start a thread, then send your computer some work." actionLabel="New thread" onAction={() => setNewOpen(true)} />
          )
        }
      />

      <NewDispatchThreadSheet
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id, title) => {
          setNewOpen(false);
          toRoot(navigation, 'DispatchThread', { conversationId: id, title: threadDisplayName(title) });
        }}
      />

      <Modal visible={!!actions} transparent animationType="fade" onRequestClose={() => setActions(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.scrim} onPress={() => setActions(null)}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setRenameValue(actions?.title ?? '');
                setRenaming(actions);
                setActions(null);
              }}
            >
              <Icon name="edit" size={20} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontSize: 15 }}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                const t = actions;
                setActions(null);
                if (t) confirmDelete(t);
              }}
            >
              <Icon name="delete" size={20} color={theme.colors.statusErrorFg} />
              <Text style={{ color: theme.colors.statusErrorFg, fontSize: 15 }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={styles.scrim}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, gap: 10 }]}>
            <Text style={{ color: theme.colors.text, fontSize: 17, fontFamily: theme.fontFamilies.display.semibold }}>Rename thread</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              maxLength={120}
              autoFocus
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />
            <View style={styles.actionsRow}>
              <Button label="Cancel" variant="secondary" onPress={() => setRenaming(null)} />
              <Button
                label="Save"
                disabled={!renameValue.trim()}
                onPress={() => {
                  const t = renaming;
                  setRenaming(null);
                  if (t) void rename({ id: t.id, title: renameValue.trim() }).unwrap().catch((e) => toast.show(getErrorMessage(e as never, 'Could not rename.'), { tone: 'error' }));
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  introText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
