import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Loader, useToast } from '@/components/ui';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetAgentTeamQuery, useGetAssignableUsersQuery, useSetAgentTeamAccessMutation } from './agentTeamsApi';
import { TeamAccessEditor } from './components/TeamAccessEditor';
import { accessCapabilities, accessPayload, accessProblem, type AccessValue } from './teamAccessRules';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamAccess'>;

/**
 * Who may reach this team — web's Access tab. Only the creator, the owner or an
 * admin (`myAccess: MANAGE`) may change it; anyone else is told so.
 */
export function AgentTeamAccessScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { teamId } = useRoute<Rt>().params;
  const toast = useToast();

  const { data: team, isLoading, error, refetch } = useGetAgentTeamQuery(teamId);
  const users = useGetAssignableUsersQuery();
  const [save, { isLoading: saving }] = useSetAgentTeamAccessMutation();

  const [value, setValue] = useState<AccessValue | null>(null);
  const [showProblem, setShowProblem] = useState(false);
  useEffect(() => {
    if (team && !value) setValue({ mode: team.accessMode, access: team.access });
  }, [team, value]);

  const back = () => navigation.goBack();
  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Team access" mode="stack" onBack={back} />
      {children}
    </View>
  );

  if (isLoading || (team && !value)) return shell(<Loader fullScreen />);
  if (error || !team || !value) return shell(<ErrorState message={getErrorMessage(error as never, 'This team could not be loaded.')} onRetry={refetch} />);
  if (!accessCapabilities(team.myAccess).canManageAccess) {
    return shell(<EmptyState icon="lock" title="You can't change access" description="Only the person who made this team, an owner or an admin can change who may reach it." />);
  }

  const onSave = async () => {
    if (accessProblem(value)) {
      setShowProblem(true);
      return;
    }
    try {
      await save({ id: team.id, ...accessPayload(value) }).unwrap();
      toast.show('Access updated.', { tone: 'success' });
      back();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not update access.'), { tone: 'error' });
    }
  };

  return shell(
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        Choose who can find and use <Text style={{ fontFamily: theme.fontFamilies.body.semibold, color: theme.colors.text }}>{team.name}</Text>. Role permissions still apply on top.
      </Text>
      <Card>
        <TeamAccessEditor
          value={value}
          onChange={setValue}
          users={users.data ?? []}
          usersLoading={users.isLoading}
          usersFailed={Boolean(users.error)}
          disabled={saving}
          showProblem={showProblem}
        />
      </Card>
      <View style={styles.actions}>
        <Button label="Cancel" variant="outline" onPress={back} disabled={saving} style={{ flex: 1 }} />
        <Button label="Save access" onPress={() => void onSave()} loading={saving} style={{ flex: 1 }} />
      </View>
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
