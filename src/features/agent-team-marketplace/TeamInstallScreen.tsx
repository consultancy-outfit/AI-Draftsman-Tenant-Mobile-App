import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, ErrorState, Loader, TextField, useToast } from '@/components/ui';
import { useGetAssignableUsersQuery } from '@/features/agent-teams/agentTeamsApi';
import { TeamAccessEditor } from '@/features/agent-teams/components/TeamAccessEditor';
import { DEFAULT_ACCESS, accessPayload, accessProblem, type AccessValue } from '@/features/agent-teams/teamAccessRules';
import type { MarketplaceStackParamList } from '@/navigation/types';
import { MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { KeyboardLift } from '@/utils/KeyboardLift';

import { readTeamCloneFailure, suggestTeamName } from './teamInstallRules';
import { useCloneMarketplaceTeamToTenantMutation, useGetMarketplaceTeamQuery } from './teamMarketplaceApi';
import { TEAM_COPY } from './teamMarketplace.data';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;

/**
 * Install a team: choose who can use it BEFORE anything is written, then install. If the team name is
 * already taken in this workspace (409 TEAM_NAME_TAKEN, nothing written), ask for another name and retry
 * with the same access. On success the post-install wizard opens (Schedule, then Connectors — both optional).
 */
export function TeamInstallScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { id } = useRoute<RouteProp<MarketplaceStackParamList, 'TeamInstall'>>().params;
  const canInstall = usePermission(MARKETPLACE_PERMISSIONS.INSTALL);

  const { data: template, isLoading, error, refetch } = useGetMarketplaceTeamQuery(id);
  const users = useGetAssignableUsersQuery();
  const [clone, { isLoading: installing }] = useCloneMarketplaceTeamToTenantMutation();

  const [access, setAccess] = useState<AccessValue>(DEFAULT_ACCESS);
  const [showProblem, setShowProblem] = useState(false);
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [name, setName] = useState('');

  const back = () => navigation.goBack();
  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Install team" mode="stack" onBack={back} />
      <KeyboardLift style={{ flex: 1 }}>{children}</KeyboardLift>
    </View>
  );

  if (isLoading) return shell(<Loader fullScreen />);
  if (error || !template) return shell(<ErrorState message={getErrorMessage(error as never, 'This team could not be loaded.')} onRetry={refetch} />);

  const install = async (chosenName?: string) => {
    if (!canInstall) {
      toast.show(TEAM_COPY.noInstall, { tone: 'warning' });
      return;
    }
    if (accessProblem(access)) {
      setShowProblem(true);
      return;
    }
    try {
      const team = await clone({ id: template.id, ...(chosenName ? { name: chosenName } : {}), ...accessPayload(access) }).unwrap();
      toast.show(TEAM_COPY.success(team.name), { tone: 'success' });
      navigation.replace('TeamInstallWizard', {
        teamId: team.id,
        teamName: team.name,
        defaultObjective: template.defaultObjective,
        requiredConnectorSlugs: template.requiredConnectorSlugs,
      });
    } catch (err) {
      const failure = readTeamCloneFailure(err);
      if (failure.nameTaken) {
        /* Nothing was written. Ask for another name and retry with the same access. */
        const attempted = chosenName ?? template.name;
        setRenameFrom(attempted);
        setName(suggestTeamName(attempted));
        return;
      }
      toast.show(failure.message || getErrorMessage(err as never, 'Could not install that team.'), { tone: failure.status === 404 ? 'warning' : 'error' });
      if (failure.status === 404) back();
    }
  };

  return shell(
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>{template.name}</Text>

      {renameFrom ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{TEAM_COPY.renameTitle}</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{TEAM_COPY.renameDescription(renameFrom)}</Text>
          <TextField value={name} onChangeText={setName} label="Team name" autoFocus maxLength={120} />
          <Button label={TEAM_COPY.renameSubmit} loading={installing} disabled={!name.trim() || name.trim() === renameFrom} onPress={() => void install(name.trim())} fullWidth />
        </Card>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{TEAM_COPY.accessTitle}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{TEAM_COPY.accessLead}</Text>
      </View>
      <Card>
        <TeamAccessEditor value={access} onChange={setAccess} users={users.data ?? []} usersLoading={users.isLoading} usersFailed={Boolean(users.error)} disabled={installing} showProblem={showProblem} />
      </Card>

      {!renameFrom ? (
        <View style={styles.actions}>
          <Button label="Cancel" variant="outline" onPress={back} disabled={installing} style={{ flex: 1 }} />
          <Button label={installing ? TEAM_COPY.installing : TEAM_COPY.install} icon="download" onPress={() => void install()} loading={installing} style={{ flex: 1 }} />
        </View>
      ) : null}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
