import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, Loader, PickerField } from '@/components/ui';
import type { LearningStackParamList } from '@/navigation/types';
import { PermissionGate } from '@/permissions';
import { LEARNING_PERMISSIONS } from '@/permissions/slugs';
import { useAppTheme } from '@/theme/ThemeContext';

import { LearningDisclaimer, LearningError, Pill, ProgressSummaryView } from '../components/LearningShared';
import { LEARNING_COPY } from '../learning.data';
import { ENROLLMENT_STATUS_LABELS, filterEnrollmentsByStatus, levelLabel, type EnrollmentStatusFilter } from '../learning.logic';
import type { Enrollment, EnrollmentStatus } from '../learning.types';
import { useGetEnrollmentsQuery } from '../learningApi';

type Nav = NativeStackNavigationProp<LearningStackParamList>;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  ...(['ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN'] as EnrollmentStatus[]).map((s) => ({ value: s, label: ENROLLMENT_STATUS_LABELS[s] })),
];
const TONE: Record<EnrollmentStatus, 'success' | 'warning' | 'info' | 'neutral'> = { ACTIVE: 'success', PAUSED: 'warning', COMPLETED: 'info', WITHDRAWN: 'neutral' };

/** My Learning — every course you are enrolled in, each with its own progress, last activity and what to do next. */
export function MyLearningScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isFetching, error, refetch } = useGetEnrollmentsQuery();
  const [status, setStatus] = useState<EnrollmentStatusFilter>('ALL');
  const rows = useMemo(() => filterEnrollmentsByStatus(data ?? [], status), [data, status]);

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const openSettings = () => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);
  const open = (e: Enrollment) => navigation.navigate('LearningWorkspace', { enrollmentId: e.id, title: e.apprenticeship.title });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="My Learning" mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
      <PermissionGate allOf={[LEARNING_PERMISSIONS.USE]} fallback={<EmptyState icon="lock" title="No access" description="Your role does not include Learning." />}>
        <FlatList
          data={error && !data ? [] : rows}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{LEARNING_COPY.myLearningDescription}</Text>
              {(data ?? []).length > 0 ? <PickerField value={status} options={STATUS_OPTIONS} onChange={(v) => setStatus(v as EnrollmentStatusFilter)} /> : null}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={item.apprenticeship.title}>
              <Card style={{ gap: 10 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, lineHeight: 22 }}>{item.apprenticeship.title}</Text>
                <View style={styles.wrap}>
                  <Pill label={levelLabel(item.apprenticeship.level)} />
                  <Pill label={ENROLLMENT_STATUS_LABELS[item.status]} tone={TONE[item.status]} />
                </View>
                <ProgressSummaryView progress={item.progress} />
                {item.nextActivity ? (
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
                    <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>Next: </Text>
                    {item.nextActivity.code} — {item.nextActivity.reason}
                  </Text>
                ) : null}
                {item.lastActivityAt ? <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>Last activity {new Date(item.lastActivityAt).toLocaleDateString('en-GB')}</Text> : null}
                <Button label="Open workspace" onPress={() => open(item)} fullWidth />
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            isLoading ? (
              <Loader label="Loading your courses…" />
            ) : error ? (
              <LearningError error={error} onRetry={() => void refetch()} />
            ) : (data ?? []).length === 0 ? (
              <EmptyState icon="school" title={LEARNING_COPY.noEnrolmentsTitle} description={LEARNING_COPY.noEnrolmentsDescription} actionLabel={LEARNING_COPY.browse} onAction={() => (navigation.getParent('RootDrawer' as never) as { navigate: (n: string) => void } | undefined)?.navigate('Apprenticeships')} />
            ) : (
              <EmptyState icon="filter-list-off" title="No courses with that status" />
            )
          }
          ListFooterComponent={(data ?? []).length > 0 ? <View style={{ paddingTop: 12 }}><LearningDisclaimer /></View> : null}
        />
      </PermissionGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
