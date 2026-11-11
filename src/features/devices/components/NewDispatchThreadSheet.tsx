import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, useToast } from '@/components/ui';
import { useGetAvailableAgentsForChatQuery } from '@/features/chat/chatApi';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useCreateDispatchThreadMutation } from '../devicesApi';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string, title: string) => void;
}

/** A name (optional) and who does the work: a deployed agent, or the workspace's default model. */
export function NewDispatchThreadSheet({ visible, onClose, onCreated }: Props) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const agents = useGetAvailableAgentsForChatQuery(undefined, { skip: !visible });
  const [create, { isLoading }] = useCreateDispatchThreadMutation();
  const deployed = (agents.data ?? []).filter((a) => a.status === 'DEPLOYED');

  const submit = async () => {
    try {
      const t = await create({ title: title.trim() || undefined, agentId: agentId ?? undefined }).unwrap();
      setTitle('');
      setAgentId(null);
      onCreated(t.id, t.title);
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not create the thread.'), { tone: 'error' });
    }
  };

  const Option = ({ id, label, hint }: { id: string | null; label: string; hint?: string }) => {
    const on = agentId === id;
    return (
      <TouchableOpacity
        onPress={() => setAgentId(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        style={[styles.option, { borderColor: on ? theme.colors.accent : theme.colors.border }]}
      >
        <Icon name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={on ? theme.colors.accent : theme.colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 14 }}>{label}</Text>
          {hint ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{hint}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 16, borderTopLeftRadius: theme.radii.sheetTop, borderTopRightRadius: theme.radii.sheetTop },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>New Dispatch thread</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="Name (optional)"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
          />
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Who does the work</Text>
          <Option id={null} label="Default model" hint="The workspace's default" />
          {deployed.slice(0, 6).map((a) => (
            <Option key={a.id} id={a.id} label={a.name} hint="Agent" />
          ))}
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} />
            <Button label="Create thread" onPress={() => void submit()} loading={isLoading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { padding: 20, gap: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
