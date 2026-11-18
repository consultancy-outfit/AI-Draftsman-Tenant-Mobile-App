import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, Icon, Loader, PickerField, StatusTabs, TextField, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/features/aiLearning/useDebouncedValue';
import type { LearningStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { CompetencyStateTag, LearningDisclaimer, LearningError, Pill, ProgressSummaryView, SafetyNotice } from '../components/LearningShared';
import { TutorPanel } from '../components/TutorPanel';
import { COMPETENCY_PAGE_SIZE, LEARNING_COPY, SEARCH_DEBOUNCE_MS } from '../learning.data';
import { COMPETENCY_STATE_LABELS, ENROLLMENT_STATUS_LABELS, KSB_TYPE_LABELS, KSB_TYPE_ORDER, levelLabel } from '../learning.logic';
import type { CompetencyState, KsbType, PlanItem } from '../learning.types';
import {
  useGetApprenticeshipQuery,
  useGetCompetenciesQuery,
  useGetEnrollmentQuery,
  useGetLearningPlanQuery,
  useMigrateEnrollmentVersionMutation,
  useUpdateEnrollmentMutation,
} from '../learningApi';

type Nav = NativeStackNavigationProp<LearningStackParamList>;
type Tab = 'plan' | 'items' | 'tutor';

const STATE_OPTIONS = [{ value: '', label: 'Any state' }, ...(['NOT_STARTED', 'IN_PROGRESS', 'DEMONSTRATED'] as CompetencyState[]).map((s) => ({ value: s, label: COMPETENCY_STATE_LABELS[s] }))];

/**
 * The learning workspace for one enrolment. The web screen is a two-column "course & plan" + tutor layout; on
 * a phone that becomes three tabs: **Plan** (what to do next, grouped), **Items** (every KSB, searchable) and
 * **Tutor** (the AI tutor chat). The header carries progress, the pinned version, pause / resume / withdraw,
 * and "Move to latest version". Writes are refused by the server on a non-active enrolment, so those are
 * view-only. Opening an item opens its own screen (assessed state, confidence, assessments, evidence).
 */
export function LearningWorkspaceScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const params = useRoute<RouteProp<LearningStackParamList, 'LearningWorkspace'>>().params;
  const { enrollmentId } = params;

  const [tab, setTab] = useState<Tab>(params.tab ?? 'plan');
  const [focusCode, setFocusCode] = useState<string | undefined>(params.focusCode);
  useEffect(() => {
    if (params.tab) setTab(params.tab);
    if (params.focusCode) setFocusCode(params.focusCode);
  }, [params.tab, params.focusCode]);

  const enrollment = useGetEnrollmentQuery(enrollmentId);
  const e = enrollment.data;
  const apprenticeship = useGetApprenticeshipQuery(e?.apprenticeshipId ?? '', { skip: !e });
  const plan = useGetLearningPlanQuery(enrollmentId);
  const [update, { isLoading: updating }] = useUpdateEnrollmentMutation();
  const [migrate, { isLoading: migrating }] = useMigrateEnrollmentVersionMutation();
  const active = e?.status === 'ACTIVE';

  /* Items tab. */
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [type, setType] = useState<KsbType | ''>('');
  const [state, setState] = useState<CompetencyState | ''>('');
  const [page, setPage] = useState(1);
  const filterKey = JSON.stringify([q, type, state]);
  useEffect(() => setPage(1), [filterKey]);
  const comps = useGetCompetenciesQuery(
    { enrollmentId, ...(q ? { search: q } : {}), ...(type ? { type } : {}), ...(state ? { state } : {}), page, limit: COMPETENCY_PAGE_SIZE },
    { skip: tab !== 'items' },
  );
  const compItems = comps.data?.items ?? [];
  const compMore = Boolean(comps.data && comps.data.page < comps.data.totalPages);
  const loadMore = () => {
    if (!comps.isFetching && compMore) setPage((p) => p + 1);
  };

  const back = () => navigation.goBack();
  const title = e?.apprenticeship.title ?? params.title ?? 'Learning';
  const openItem = (code: string, statement?: string) =>
    navigation.navigate('CompetencyDetail', { enrollmentId, code, ...(statement ? { statement } : {}), readOnly: !active });

  const setStatus = (status: 'ACTIVE' | 'PAUSED' | 'WITHDRAWN') => {
    const doIt = async () => {
      try {
        await update({ enrollmentId, status }).unwrap();
        toast.show(status === 'ACTIVE' ? 'Course resumed.' : status === 'PAUSED' ? 'Course paused.' : 'You have withdrawn from this course.', { tone: 'success' });
      } catch (err) {
        toast.show(getErrorMessage(err as never, 'Could not update this course.'), { tone: 'error' });
      }
    };
    if (status === 'WITHDRAWN') {
      Alert.alert('Withdraw from this course?', 'Your progress and history are kept, but you will not be able to continue unless you enrol again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', style: 'destructive', onPress: () => void doIt() },
      ]);
    } else void doIt();
  };

  const migrateNow = () =>
    Alert.alert(LEARNING_COPY.migrateTitle, LEARNING_COPY.migrateBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: LEARNING_COPY.migrateConfirm,
        style: 'destructive',
        onPress: () => {
          void migrate(enrollmentId)
            .unwrap()
            .then(() => toast.show('Moved to the latest version.', { tone: 'success' }))
            .catch((err) => toast.show(getErrorMessage(err as never, 'Could not move to the latest version.'), { tone: 'error' }));
        },
      },
    ]);

  const planRows = useMemo(() => {
    type Row = { kind: 'group'; key: string; title: string } | { kind: 'item'; key: string; item: PlanItem };
    const out: Row[] = [];
    for (const g of plan.data?.groups ?? []) {
      out.push({ kind: 'group', key: `g:${g.dutyCode ?? g.title}`, title: g.title });
      for (const item of g.items) out.push({ kind: 'item', key: `i:${item.code}`, item });
    }
    return out;
  }, [plan.data]);

  if (enrollment.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={back} />
        <Loader fullScreen />
      </View>
    );
  }
  if (enrollment.error || !e) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={title} mode="stack" onBack={back} />
        <LearningError error={enrollment.error} onRetry={() => void enrollment.refetch()} />
      </View>
    );
  }

  const text = (s: string, style: object = {}) => (
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17, ...style }}>{s}</Text>
  );

  const summary = (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <View style={styles.wrap}>
          <Pill label={levelLabel(e.apprenticeship.level)} />
          <Pill label={ENROLLMENT_STATUS_LABELS[e.status]} tone={e.status === 'ACTIVE' ? 'success' : e.status === 'PAUSED' ? 'warning' : e.status === 'COMPLETED' ? 'info' : 'neutral'} />
          <Pill label={`Version ${e.pinnedVersion.seq}`} />
        </View>
        <ProgressSummaryView progress={e.progress} />
      </View>

      {apprenticeship.data?.safetyNotice ? <SafetyNotice text={apprenticeship.data.safetyNotice} /> : null}

      {e.newerVersionAvailable ? (
        <View style={[styles.banner, { backgroundColor: theme.colors.statusInfoBg, borderRadius: theme.radii.lg }]}>
          <Icon name="system-update" size={20} color={theme.colors.statusInfoFg} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: theme.colors.statusInfoFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>A newer version is available</Text>
            {text(`Version ${e.newerVersionAvailable.seq} (standard ${e.newerVersionAvailable.standardVersion}). You are on version ${e.pinnedVersion.seq}.`, { color: theme.colors.statusInfoFg })}
            {active ? <Button label={LEARNING_COPY.migrateConfirm} size="sm" variant="outline" loading={migrating} onPress={migrateNow} /> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.wrap}>
        {e.status === 'ACTIVE' ? <Button label="Pause" icon="pause" size="sm" variant="outline" loading={updating} onPress={() => setStatus('PAUSED')} /> : null}
        {e.status === 'PAUSED' ? <Button label="Resume" icon="play-arrow" size="sm" loading={updating} onPress={() => setStatus('ACTIVE')} /> : null}
        {e.status === 'ACTIVE' || e.status === 'PAUSED' ? <Button label="Withdraw" icon="logout" size="sm" variant="outline" disabled={updating} onPress={() => setStatus('WITHDRAWN')} /> : null}
      </View>
      {!active ? text(e.status === 'PAUSED' ? 'This course is paused. Resume it to continue; you can still look around.' : 'This course is view-only.') : null}

      {e.nextActivity && active ? (
        <TouchableOpacity onPress={() => openItem(e.nextActivity?.code ?? '', e.nextActivity?.statement)} accessibilityRole="button">
          <Card style={{ gap: 4 }}>
            <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 }}>Next activity · {e.nextActivity.kind.toLowerCase()}</Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{e.nextActivity.code}</Text>
            <Text numberOfLines={2} style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{e.nextActivity.statement}</Text>
            {text(e.nextActivity.reason)}
          </Card>
        </TouchableOpacity>
      ) : null}

      <StatusTabs
        tabs={[
          { value: 'plan', label: 'Plan' },
          { value: 'items', label: 'Items' },
          { value: 'tutor', label: 'AI tutor' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />
    </View>
  );

  const container = (
    <FlatList<any>
      data={tab === 'plan' ? planRows : tab === 'items' ? (comps.error && compItems.length === 0 ? [] : compItems) : []}
      keyExtractor={(row) => (tab === 'plan' ? row.key : row.code)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            void enrollment.refetch();
            void plan.refetch();
            if (tab === 'items') (page === 1 ? void comps.refetch() : setPage(1));
          }}
          tintColor={theme.colors.accent}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {summary}
          {tab === 'items' ? (
            <View style={{ gap: 10 }}>
              <TextField value={search} onChangeText={setSearch} placeholder="Search items" leftIcon="search" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
              <StatusTabs
                tabs={[{ value: '', label: 'All' }, ...KSB_TYPE_ORDER.map((t) => ({ value: t, label: KSB_TYPE_LABELS[t] }))]}
                value={type}
                onChange={(v) => setType(v as KsbType | '')}
              />
              <PickerField value={state} options={STATE_OPTIONS} onChange={(v) => setState(v as CompetencyState | '')} />
            </View>
          ) : null}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) =>
        tab === 'plan' ? (
          item.kind === 'group' ? (
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, marginTop: 8 }}>{item.title}</Text>
          ) : (
            <ItemRow code={item.item.code} statement={item.item.statement} state={item.item.state} high={item.item.priority === 'HIGH'} onPress={() => openItem(item.item.code, item.item.statement)} />
          )
        ) : (
          <ItemRow code={item.code} statement={item.statement} state={item.state} retired={item.retired} onPress={() => openItem(item.code, item.statement)} />
        )
      }
      ListEmptyComponent={
        tab === 'plan' ? (
          plan.isLoading ? <Loader label="Loading your plan…" /> : plan.error ? <LearningError error={plan.error} onRetry={() => void plan.refetch()} /> : <EmptyState icon="checklist" title="No plan yet" description="Your plan appears once the course has items." />
        ) : comps.isLoading ? (
          <Loader label="Loading items…" />
        ) : comps.error ? (
          <LearningError error={comps.error} onRetry={() => void comps.refetch()} />
        ) : (
          <EmptyState icon="search-off" title="No items match" description="Try a different search or filter." />
        )
      }
      onEndReached={tab === 'items' ? loadMore : undefined}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        <View style={{ paddingTop: 12, gap: 12 }}>
          {tab === 'items' && comps.isFetching && page > 1 ? <Loader label="Loading more…" /> : tab === 'items' && compMore ? <Button label="Load more" variant="outline" onPress={loadMore} fullWidth /> : null}
          <LearningDisclaimer />
        </View>
      }
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} mode="stack" onBack={back} />
      {tab === 'tutor' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.tutorTop, { borderBottomColor: theme.colors.border }]}>
            <StatusTabs
              tabs={[
                { value: 'plan', label: 'Plan' },
                { value: 'items', label: 'Items' },
                { value: 'tutor', label: 'AI tutor' },
              ]}
              value={tab}
              onChange={(v) => setTab(v as Tab)}
            />
          </View>
          <TutorPanel enrollmentId={enrollmentId} enrolmentActive={active} focusCode={focusCode} onClearFocus={() => setFocusCode(undefined)} onOpenItem={(code) => openItem(code)} />
        </View>
      ) : (
        container
      )}
    </View>
  );
}

function ItemRow({ code, statement, state, high, retired, onPress }: { code: string; statement: string; state: CompetencyState; high?: boolean; retired?: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${code}. ${statement}`}>
      <Card style={{ gap: 6 }}>
        <View style={styles.rowTop}>
          <Text style={{ flex: 1, color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{code}</Text>
          {high ? <Pill label="Priority" tone="warning" /> : null}
          {retired ? <Pill label="Retired" tone="neutral" /> : null}
          <CompetencyStateTag state={state} />
        </View>
        <Text numberOfLines={3} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{statement}</Text>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tutorTop: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
