import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Icon, Loader, PickerField, TextField, useToast } from '@/components/ui';
import {
  useCreateAgentTeamScheduleMutation,
  useGetAgentTeamQuery,
  useUpdateAgentTeamMutation,
} from '@/features/agent-teams/agentTeamsApi';
import {
  DEFAULT_SCHEDULE_PRESET,
  SCHEDULE_COPY,
  SCHEDULE_OBJECTIVE_MAX,
  SCHEDULE_PRESET_OPTIONS,
  deviceTimezone,
  timezoneOptions,
} from '@/features/agent-teams/agentTeamsRules';
import { useGetConnectorInstallsQuery, useGetConnectorQuery } from '@/features/marketplace/marketplaceApi';
import type { MarketplaceStackParamList } from '@/navigation/types';
import { AGENT_TEAM_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { KeyboardLift } from '@/utils/KeyboardLift';

import { defaultConnectorSelection } from './teamInstallRules';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;

const RequiredName = ({ slug }: { slug: string }) => {
  const { data } = useGetConnectorQuery(slug);
  return <>{data?.name ?? slug}</>;
};

/**
 * What opens right after an Agent Team is installed: 1. Schedule (run the team on a timer), 2. Connectors
 * (attach the tools it acts through). Both are optional and both write to the team that already exists, so
 * leaving at any point leaves a working team. "Connect" opens the connector screen; an OAuth connect hands
 * off to the system browser and this screen — still in the stack — re-reads the installs when you return.
 */
export function TeamInstallWizardScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const target = useRoute<RouteProp<MarketplaceStackParamList, 'TeamInstallWizard'>>().params;
  const canSchedule = usePermission(AGENT_TEAM_PERMISSIONS.SCHEDULE);
  const canAttach = usePermission(AGENT_TEAM_PERMISSIONS.BUILD);
  const [step, setStep] = useState<0 | 1>(0);

  /* Step 1 — schedule. */
  const [createSchedule, { isLoading: savingSchedule }] = useCreateAgentTeamScheduleMutation();
  const [preset, setPreset] = useState<string>(DEFAULT_SCHEDULE_PRESET);
  const [objective, setObjective] = useState(target.defaultObjective ?? '');
  const [timezone, setTimezone] = useState(deviceTimezone());
  const [objectiveError, setObjectiveError] = useState<string | undefined>();
  const zones = useMemo(() => timezoneOptions(), []);

  /* Step 2 — connectors. */
  const installsQuery = useGetConnectorInstallsQuery();
  const teamQuery = useGetAgentTeamQuery(target.teamId);
  const [updateTeam, { isLoading: savingConnectors }] = useUpdateAgentTeamMutation();
  const installs = useMemo(() => installsQuery.data ?? [], [installsQuery.data]);
  const activeBySlug = useMemo(() => {
    const map: Record<string, (typeof installs)[number]> = {};
    for (const i of installs) if (i.status === 'active') map[i.connectorSlug] = i;
    return map;
  }, [installs]);
  /* null = untouched, so the derived default shows (what the team already has, else an active install of each required connector). */
  const [picked, setPicked] = useState<string[] | null>(null);
  const derived = useMemo(
    () => defaultConnectorSelection(teamQuery.data?.connectorInstallIds ?? [], target.requiredConnectorSlugs, installs),
    [teamQuery.data, target.requiredConnectorSlugs, installs],
  );
  const selected = picked ?? derived;
  const toggle = (id: string) => setPicked((selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]));

  /* Coming back from the connector screen or the system browser: read what is connected now. */
  const refetchInstalls = installsQuery.refetch;
  useFocusEffect(useCallback(() => void refetchInstalls(), [refetchInstalls]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refetchInstalls();
    });
    return () => sub.remove();
  }, [refetchInstalls]);

  const close = () => navigation.popToTop();
  const finish = async () => {
    if (canAttach) {
      try {
        await updateTeam({ id: target.teamId, body: { connectorInstallIds: selected } }).unwrap();
        if (selected.length > 0) toast.show(`${selected.length} connector${selected.length === 1 ? '' : 's'} attached to the team.`, { tone: 'success' });
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not attach the connectors.'), { tone: 'error' });
        return;
      }
    }
    toast.show(`“${target.teamName}” is ready. Find it under My teams.`, { tone: 'success' });
    close();
  };

  const onCreateSchedule = async () => {
    if (!objective.trim()) {
      setObjectiveError('Tell the team what to do on each run.');
      return;
    }
    setObjectiveError(undefined);
    try {
      await createSchedule({ teamId: target.teamId, body: { preset, objective: objective.trim(), ...(timezone.trim() ? { timezone: timezone.trim() } : {}) } }).unwrap();
      toast.show('Schedule created. Every occurrence is a full team run and is charged like any other.', { tone: 'success' });
      setStep(1);
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not create the schedule.'), { tone: 'error' });
    }
  };

  const lead = (text: string) => (
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{text}</Text>
  );
  const info = (text: string) => (
    <View style={[styles.note, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.lg }]}>
      <Icon name="info-outline" size={18} color={theme.colors.statusInfoFg} />
      <Text style={{ flex: 1, color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={`Set up “${target.teamName}”`} mode="stack" onBack={close} />
      <KeyboardLift style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {lead('The team is installed and ready to run. Both steps are optional.')}
          <View style={styles.steps}>
            {['Schedule', 'Connectors'].map((label, i) => (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: i <= step ? theme.colors.accent : theme.colors.statusNeutralBg }]}>
                  <Text style={{ color: i <= step ? theme.colors.textOnAccent : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{i + 1}</Text>
                </View>
                <Text style={{ color: i === step ? theme.colors.text : theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{label}</Text>
              </View>
            ))}
          </View>

          {step === 0 ? (
            <>
              {lead('Run this team on a timer. Each run is written into a thread of its own that you can read later. You can add or change schedules any time from the team’s page.')}
              {!canSchedule ? (
                info('Your role cannot schedule team runs (agent_team.schedule). Skip this step — someone who can may add a schedule later.')
              ) : (
                <Card style={{ gap: 12 }}>
                  <PickerField label="How often" value={preset} options={SCHEDULE_PRESET_OPTIONS} onChange={setPreset} />
                  <TextField
                    label="What should the team do *"
                    value={objective}
                    onChangeText={setObjective}
                    multiline
                    numberOfLines={4}
                    maxLength={SCHEDULE_OBJECTIVE_MAX}
                    style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 10 }}
                    hint={SCHEDULE_COPY.objectiveHint}
                    error={objectiveError}
                  />
                  <PickerField label="Timezone" value={timezone} options={zones} onChange={setTimezone} searchable />
                </Card>
              )}
              <View style={styles.actions}>
                <Button label="Skip" variant="outline" onPress={() => setStep(1)} disabled={savingSchedule} style={{ flex: 1 }} />
                {canSchedule ? <Button label="Create schedule" onPress={() => void onCreateSchedule()} loading={savingSchedule} style={{ flex: 1 }} /> : null}
              </View>
            </>
          ) : (
            <>
              {lead('Connectors let the team act in your tools. Attach the ones it should use — you can change this later from a team chat’s attach menu.')}
              {!canAttach ? info('Your role cannot edit teams (agent_team.build), so connectors cannot be attached here. Skip this step.') : null}

              {target.requiredConnectorSlugs.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>This team works with</Text>
                  {target.requiredConnectorSlugs.map((slug) => {
                    const install = activeBySlug[slug];
                    return (
                      <View key={slug} style={styles.reqRow}>
                        <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
                          {install ? install.connectorName : <RequiredName slug={slug} />}
                        </Text>
                        {install ? (
                          <View style={[styles.pill, { backgroundColor: theme.colors.statusSuccessBg, borderRadius: theme.radii.full }]}>
                            <Text style={{ color: theme.colors.statusSuccessFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>Connected</Text>
                          </View>
                        ) : (
                          <Button label="Connect" size="sm" variant="outline" onPress={() => navigation.navigate('ConnectorDetail', { slug })} />
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Attach to the team</Text>
                {installsQuery.isLoading || teamQuery.isLoading ? (
                  <Loader label="Loading your connectors…" />
                ) : installs.filter((i) => i.status === 'active').length === 0 ? (
                  lead('You have no connected connectors yet. Connect one above, or skip.')
                ) : (
                  installs
                    .filter((i) => i.status === 'active')
                    .map((i) => {
                      const on = selected.includes(i.id);
                      return (
                        <TouchableOpacity
                          key={i.id}
                          disabled={!canAttach}
                          onPress={() => toggle(i.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on, disabled: !canAttach }}
                          style={[styles.check, { borderColor: on ? theme.colors.accent : theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, opacity: canAttach ? 1 : 0.6 }]}
                        >
                          <Icon name={on ? 'check-box' : 'check-box-outline-blank'} size={22} color={on ? theme.colors.accent : theme.colors.textMuted} />
                          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{i.connectorName}</Text>
                        </TouchableOpacity>
                      );
                    })
                )}
              </View>

              <View style={styles.actions}>
                <Button label="Back" variant="outline" onPress={() => setStep(0)} disabled={savingConnectors} style={{ flex: 1 }} />
                <Button label="Finish" onPress={() => void finish()} loading={savingConnectors} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardLift>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  steps: { flexDirection: 'row', gap: 20 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  pill: { paddingHorizontal: 10, paddingVertical: 3 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1 },
});
