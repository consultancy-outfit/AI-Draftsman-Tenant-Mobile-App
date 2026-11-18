import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, ErrorState, Icon, Loader } from '@/components/ui';
import { useGetConnectorQuery } from '@/features/marketplace/marketplaceApi';
import type { MarketplaceStackParamList } from '@/navigation/types';
import { MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetMarketplaceTeamQuery } from './teamMarketplaceApi';
import { TEAM_COPY } from './teamMarketplace.data';
import { useInstalledTemplates } from './useTeamCatalogue';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;

const ConnectorName = ({ slug }: { slug: string }) => {
  const { data } = useGetConnectorQuery(slug);
  return <>{data?.name ?? slug}</>;
};

/**
 * One team template: what it is for, the agents it installs (in the order they answer), the connectors it
 * works with, and Install (or Open once this workspace has it). A template whose agents are not all
 * evaluated by the platform cannot be installed yet.
 */
export function MarketplaceTeamDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { id } = useRoute<RouteProp<MarketplaceStackParamList, 'MarketplaceTeamDetail'>>().params;
  const canInstall = usePermission(MARKETPLACE_PERMISSIONS.INSTALL);
  const { data: team, isLoading, error, refetch } = useGetMarketplaceTeamQuery(id);
  const installed = useInstalledTemplates();
  const back = () => navigation.goBack();
  const installedTeamId = installed.installedIds[id];

  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={team?.name ?? 'Agent team'} mode="stack" onBack={back} />
      {children}
    </View>
  );

  if (isLoading) return shell(<Loader fullScreen />);
  if (error || !team) {
    const notFound = (error as { status?: number } | undefined)?.status === 404;
    return shell(
      notFound ? (
        <EmptyState icon="search-off" title="Team not found" description="This template is no longer in the marketplace." />
      ) : (
        <ErrorState message={getErrorMessage(error as never, 'This team could not be loaded.')} onRetry={refetch} />
      ),
    );
  }

  const heading = (text: string) => (
    <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{text}</Text>
  );
  const body = (text: string) => (
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{text}</Text>
  );

  return shell(
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl, lineHeight: 30 }}>{team.name}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
          {team.category?.name ?? 'Other'} · {team.members.length} agent{team.members.length === 1 ? '' : 's'}
          {team.installCount > 0 ? ` · ${team.installCount} install${team.installCount === 1 ? '' : 's'}` : ''}
        </Text>
      </View>

      {team.description ? body(team.description) : null}
      {team.purpose && team.purpose !== team.description ? (
        <View style={{ gap: 4 }}>
          {heading('Purpose')}
          {body(team.purpose)}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        {heading('Agents')}
        {[...team.members]
          .sort((a, b) => a.priority - b.priority)
          .map((m) => (
            <Card key={m.id} style={{ gap: 4 }}>
              <View style={styles.row}>
                <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{m.name}</Text>
                <Icon name={m.evaluated ? 'verified' : 'hourglass-empty'} size={18} color={m.evaluated ? theme.colors.statusSuccessFg : theme.colors.statusWarningFg} />
              </View>
              {m.description ? body(m.description) : null}
            </Card>
          ))}
      </View>

      {team.requiredConnectorSlugs.length > 0 ? (
        <View style={{ gap: 8 }}>
          {heading('Works with')}
          <View style={styles.wrap}>
            {team.requiredConnectorSlugs.map((slug) => (
              <View key={slug} style={[styles.pill, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
                <Text style={{ color: theme.colors.statusNeutralFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                  <ConnectorName slug={slug} />
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!team.ready ? (
        <View style={[styles.note, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.lg }]}>
          <Icon name="hourglass-empty" size={18} color={theme.colors.statusWarningFg} />
          <Text style={{ flex: 1, color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{TEAM_COPY.notReady}</Text>
        </View>
      ) : null}

      {installedTeamId ? (
        <Button
          label={TEAM_COPY.openTeam}
          icon="open-in-new"
          variant="outline"
          fullWidth
          onPress={() =>
            (navigation as unknown as { getParent: (id: string) => { navigate: (...a: unknown[]) => void } | undefined })
              .getParent('RootDrawer')
              ?.navigate('AgentTeams', { screen: 'AgentTeamDetail', params: { id: installedTeamId, name: team.name } })
          }
        />
      ) : (
        <Button label={TEAM_COPY.install} icon="download" fullWidth disabled={!team.ready || !canInstall} onPress={() => navigation.navigate('TeamInstall', { id: team.id })} />
      )}
      {!canInstall && !installedTeamId ? body(TEAM_COPY.noInstall) : null}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 5 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
});
