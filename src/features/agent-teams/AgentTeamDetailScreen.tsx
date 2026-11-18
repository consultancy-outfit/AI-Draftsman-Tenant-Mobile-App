import { useMemo, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Icon, Loader, useToast } from '@/components/ui';
import { formatRelativeTime } from '@/utils/format';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { AGENT_TEAM_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AgentTeamMember, AgentTeamSchedule } from './agentTeams.types';
import {
  useDeleteAgentTeamScheduleMutation,
  useGetAgentTeamQuery,
  useGetAgentTeamSchedulesQuery,
  useGetAssignableUsersQuery,
  useRemoveAgentTeamMemberMutation,
  useRunAgentTeamScheduleNowMutation,
  useUpdateAgentTeamMemberMutation,
  useUpdateAgentTeamScheduleMutation,
} from './agentTeamsApi';
import { MEMBER_COPY, SCHEDULE_COPY, chatBlockedReason, detailChatLabel, hierarchyRows, teamChatTarget, toAgentTeamRow } from './agentTeamsRules';
import { NotReadyBanner } from './components/NotReadyBanner';
import { ACCESS_MODE_COPY, ACCESS_ROLE_COPY } from './teamAccessRules';
import { MemberCard } from './components/MemberCard';
import { ScheduleCard } from './components/ScheduleCard';
import { ReportingLine } from './components/ReportingLine';
import { TagChip } from './components/TagChip';
import { UnderlineTabs } from './components/UnderlineTabs';
import { openNewTeamChat, openTeamConversation } from './openTeamConversation';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type Rt = RouteProp<AgentTeamsStackParamList, 'AgentTeamDetail'>;
type Tab = 'members' | 'schedules' | 'access';


/**
 * One team — web's `AgentTeamBuilder` (`/agent-teams/:id`): a header with
 * the revision and the Chat button, then two tabs. Members lists the
 * specialists (enable switch, Remove, Add specialist) and the reporting
 * line; Schedules lists the team's recurring runs (Pause/Resume, Run now,
 * Stop, Add schedule).
 */
export function AgentTeamDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const toast = useToast();

  const hasBuild = usePermission(AGENT_TEAM_PERMISSIONS.BUILD);
  const hasSchedule = usePermission(AGENT_TEAM_PERMISSIONS.SCHEDULE);

  const [tab, setTab] = useState<Tab>('members');

  const { data: team, isLoading, isFetching, error, refetch } = useGetAgentTeamQuery(params.id);
  /* Fetched only while the Schedules tab is open, as on web. */
  const schedulesQuery = useGetAgentTeamSchedulesQuery(params.id, { skip: tab !== 'schedules' });

  const [removeMember, { isLoading: isRemoving }] = useRemoveAgentTeamMemberMutation();
  const [updateMember, { isLoading: isUpdating }] = useUpdateAgentTeamMemberMutation();
  const [updateSchedule] = useUpdateAgentTeamScheduleMutation();
  const [deleteSchedule] = useDeleteAgentTeamScheduleMutation();
  const [runScheduleNow] = useRunAgentTeamScheduleNowMutation();
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  /* Role permissions AND this team's own access: a Viewer or Runner on a shared team may
     not edit it, whatever their role says. */
  const row = team ? toAgentTeamRow(team) : null;
  const canBuild = hasBuild && Boolean(row?.canEditTeam);
  const canSchedule = hasSchedule && Boolean(row?.canEditTeam);
  const blockedReason = row ? chatBlockedReason(row) : '';
  /* People are only needed to name who a team is shared with. */
  const usersQuery = useGetAssignableUsersQuery(undefined, { skip: tab !== 'access' });

  const openAgent = (agentId: string) =>
    (navigation as unknown as { getParent: (id: string) => { navigate: (...a: unknown[]) => void } | undefined })
      .getParent('RootDrawer')
      ?.navigate('MainTabs', { screen: 'CompanyAgentsTab', params: { screen: 'AgentDetail', params: { id: agentId } } });

  const isMemberSubmitting = isRemoving || isUpdating;
  const hierarchy = useMemo(() => (team ? hierarchyRows(team) : []), [team]);
  const title = team?.name ?? params.name ?? 'Team';

  const handleChat = () => {
    if (!team) return;
    if (blockedReason) {
      toast.show(blockedReason, { tone: 'warning' });
      return;
    }
    const target = teamChatTarget(toAgentTeamRow(team));
    if (target.kind === 'thread') openTeamConversation(navigation, target.conversationId, team.name);
    else openNewTeamChat(navigation as never, target.agentIds);
  };

  const handleToggleMember = async (member: AgentTeamMember) => {
    try {
      await updateMember({ teamId: params.id, memberId: member.id, enabled: !member.enabled }).unwrap();
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not update that member.'), { tone: 'error' });
    }
  };

  const handleRemoveMember = (member: AgentTeamMember) => {
    Alert.alert(MEMBER_COPY.removeTitle(member.name), MEMBER_COPY.removeBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember({ teamId: params.id, memberId: member.id }).unwrap();
            toast.show(MEMBER_COPY.removed(member.name), { tone: 'success' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not remove that member.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const handleToggleSchedule = async (schedule: AgentTeamSchedule) => {
    try {
      await updateSchedule({ teamId: params.id, scheduleId: schedule.id, enabled: !schedule.enabled }).unwrap();
      toast.show(schedule.enabled ? SCHEDULE_COPY.paused : SCHEDULE_COPY.resumed, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not update that schedule.'), { tone: 'error' });
    }
  };

  const handleRunNow = async (schedule: AgentTeamSchedule) => {
    setRunningScheduleId(schedule.id);
    try {
      await runScheduleNow({ teamId: params.id, scheduleId: schedule.id }).unwrap();
      toast.show(SCHEDULE_COPY.runStarted, { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not start that run.'), { tone: 'error' });
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleStopSchedule = (schedule: AgentTeamSchedule) => {
    Alert.alert(SCHEDULE_COPY.stopTitle(schedule.preset), SCHEDULE_COPY.stopBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: SCHEDULE_COPY.stopConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSchedule({ teamId: params.id, scheduleId: schedule.id }).unwrap();
            /* "Stopped", not "deleted": the thread and its past runs stay. */
            toast.show(SCHEDULE_COPY.stopped, { tone: 'success' });
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not stop that schedule.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <Loader fullScreen />
      </View>
    );
  }

  if (error || !team) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={() => navigation.goBack()} />
        <ErrorState message={getErrorMessage(error as never, 'This team could not be loaded.')} onRetry={refetch} />
      </View>
    );
  }

  const schedules = schedulesQuery.data ?? [];

  const activeCount = team.specialists.filter((m) => m.enabled).length;

  const sectionHeader = (title: string, subtitle: string, action?: ReactNode) => (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>{title}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {action}
    </View>
  );

  const membersTab = (
    <>
      {sectionHeader(
        'Specialists',
        team.specialists.length === 0 ? 'No one answers for this team yet.' : `${activeCount} of ${team.specialists.length} active`,
        canBuild ? <Button label="Add" icon="person-add" size="sm" onPress={() => navigation.navigate('AgentTeamAddMember', { teamId: team.id })} /> : undefined,
      )}

      {team.specialists.length === 0 ? (
        <EmptyState icon="group-add" title={MEMBER_COPY.emptyTitle} description={MEMBER_COPY.emptyDescription} />
      ) : (
        team.specialists.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            canBuild={canBuild}
            isSubmitting={isMemberSubmitting}
            onToggle={() => void handleToggleMember(member)}
            onRemove={() => handleRemoveMember(member)}
          />
        ))
      )}

      <View style={{ marginTop: 8 }}>{sectionHeader('Reporting line', 'Who plans the work and who answers')}</View>
      <ReportingLine teamName={team.name} rows={hierarchy} />
    </>
  );

  const schedulesTab = (
    <>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold }]}>{SCHEDULE_COPY.title}</Text>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, marginTop: 2 }}>Runs this team on its own, on a timetable</Text>
        </View>
        {canSchedule && <Button label="Add" icon="event" size="sm" onPress={() => navigation.navigate('AgentTeamScheduleForm', { teamId: team.id })} />}
      </View>

      {schedulesQuery.isLoading ? (
        <Loader label="Loading schedules…" />
      ) : schedulesQuery.error ? (
        <ErrorState message={getErrorMessage(schedulesQuery.error as never, 'Schedules could not be loaded.')} onRetry={schedulesQuery.refetch} />
      ) : schedules.length === 0 ? (
        <EmptyState icon="schedule" title={SCHEDULE_COPY.emptyTitle} description={SCHEDULE_COPY.empty} />
      ) : (
        <>
          {/* Stated on the panel, not in a tooltip: a recurring run spends
              money with nobody watching. */}
          <View style={[styles.callout, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.lg }]}>
            <Icon name="warning-amber" size={18} color={theme.colors.statusWarningFg} />
            <Text style={{ color: theme.colors.statusWarningFg, fontSize: theme.fontSizes.xs, lineHeight: 17, flex: 1 }}>
              <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>{SCHEDULE_COPY.spendTitle} </Text>
              {SCHEDULE_COPY.spendNote}
            </Text>
          </View>
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              canSchedule={canSchedule}
              isRunning={runningScheduleId === schedule.id}
              onPause={() => void handleToggleSchedule(schedule)}
              onRunNow={() => void handleRunNow(schedule)}
              onStop={() => handleStopSchedule(schedule)}
            />
          ))}
        </>
      )}
    </>
  );

  const users = usersQuery.data ?? [];
  const nameOf = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    return u ? u.name?.trim() || u.email : 'A colleague';
  };
  const accessTab = (
    <>
      {sectionHeader(
        'Access',
        ACCESS_MODE_COPY[team.accessMode].description,
        row?.canManageAccess ? <Button label="Edit" icon="edit" size="sm" onPress={() => navigation.navigate('AgentTeamAccess', { teamId: team.id })} /> : undefined,
      )}
      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl, gap: 8 }]}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{ACCESS_MODE_COPY[team.accessMode].label}</Text>
        {team.accessMode === 'SPECIFIC' ? (
          team.access.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
              {row?.canManageAccess ? 'Nobody else yet.' : 'The people it is shared with are only shown to whoever manages it.'}
            </Text>
          ) : (
            team.access.map((g) => (
              <View key={g.userId} style={styles.grantRow}>
                <Text numberOfLines={1} style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
                  {nameOf(g.userId)}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{ACCESS_ROLE_COPY[g.role].label}</Text>
              </View>
            ))
          )
        ) : null}
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          Your access: {team.myAccess === 'MANAGE' ? 'manage' : team.myAccess === 'EDIT' ? 'edit' : team.myAccess === 'USE' ? 'use' : 'view only'}.
        </Text>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={team.name} mode="stack" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void refetch();
              if (tab === 'schedules') void schedulesQuery.refetch();
            }}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Header card — identity, purpose, the numbers, and the one action. */}
        <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: team.origin === 'THREAD' ? theme.colors.statusInfoBg : theme.colors.accent + '1A', borderRadius: theme.radii.lg }]}>
              <Icon name={team.origin === 'THREAD' ? 'forum' : 'account-tree'} size={24} color={team.origin === 'THREAD' ? theme.colors.statusInfoFg : theme.colors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.xl }} numberOfLines={2}>
                {team.name}
              </Text>
              <TagChip label={team.origin === 'THREAD' ? 'From a team chat' : 'Built on the Teams page'} tone={team.origin === 'THREAD' ? 'info' : 'neutral'} />
            </View>
          </View>

          {team.purpose && team.purpose !== team.name ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{team.purpose}</Text>
          ) : null}

          <View style={[styles.metrics, { backgroundColor: theme.colors.statusNeutralBg, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
            {[
              { label: 'SPECIALISTS', value: `${activeCount}/${team.specialists.length}`, icon: 'smart-toy' as const },
              { label: 'REVISION', value: `v${team.currentRevision}` },
              { label: 'UPDATED', value: formatRelativeTime(team.updatedAt) },
            ].map((m, i) => (
              <View key={m.label} style={[styles.metric, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border, paddingLeft: 12 }]}>
                <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>{m.label}</Text>
                <View style={styles.metricRow}>
                  {m.icon ? <Icon name={m.icon} size={14} color={theme.colors.textMuted} /> : null}
                  <Text style={[styles.metricValue, { color: theme.colors.text }]} numberOfLines={1}>
                    {m.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {!team.readiness.ready ? <NotReadyBanner pending={team.readiness.pendingMembers} onOpenAgent={openAgent} /> : null}

          <Button label={detailChatLabel(team.origin)} icon="chat-bubble-outline" onPress={handleChat} fullWidth disabled={Boolean(blockedReason)} />
          {blockedReason && team.readiness.ready ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, textAlign: 'center' }}>{blockedReason}</Text>
          ) : null}
        </View>

        <UnderlineTabs
          tabs={[
            { value: 'members' as Tab, label: 'Members', count: team.specialists.length },
            { value: 'schedules' as Tab, label: 'Schedules', ...(schedulesQuery.data ? { count: schedules.length } : {}) },
            { value: 'access' as Tab, label: 'Access' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'members' ? membersTab : tab === 'schedules' ? schedulesTab : accessTab}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  hero: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 12, gap: 12 },
  metric: { flex: 1, gap: 3 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { fontFamily: 'InstrumentSans_700Bold', fontSize: 10, letterSpacing: 0.4 },
  metricValue: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  sectionTitle: { fontSize: 17 },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
  grantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
