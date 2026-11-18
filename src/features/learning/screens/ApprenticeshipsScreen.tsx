import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, EmptyState, Loader, PickerField, TextField } from '@/components/ui';
import type { LearningStackParamList } from '@/navigation/types';
import { PermissionGate } from '@/permissions';
import { LEARNING_PERMISSIONS } from '@/permissions/slugs';
import { useAppTheme } from '@/theme/ThemeContext';
import { useDebouncedValue } from '@/features/aiLearning/useDebouncedValue';

import { FavouriteToggle } from '../components/FavouriteToggle';
import { LearningDisclaimer, LearningError, Pill } from '../components/LearningShared';
import {
  ENROLMENT_FILTER_OPTIONS,
  FAVOURITE_FILTER_OPTIONS,
  LEARNING_COPY,
  LEVEL_FILTER_OPTIONS,
  MARKETPLACE_PAGE_SIZE,
  ROUTE_FILTER_OPTIONS,
  SEARCH_DEBOUNCE_MS,
} from '../learning.data';
import { ENROL_CTA_LABELS, enrolCta, enrolmentTag, levelLabel } from '../learning.logic';
import type { ApprenticeshipSummary } from '../learning.types';
import { useGetApprenticeshipsQuery } from '../learningApi';
import { useEnrol } from '../useEnrol';

type Nav = NativeStackNavigationProp<LearningStackParamList>;

/**
 * Apprenticeship Marketplace — browse published apprenticeship standards and enrol. Search and every filter
 * are server params (nothing is filtered on the phone); the list pages with "Load more". Enrolling opens the
 * workspace. Gated on `learning.use`, like the sidebar row and the API.
 */
export function ApprenticeshipsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [level, setLevel] = useState('');
  const [route, setRoute] = useState('');
  const [enrolment, setEnrolment] = useState('');
  const [favourite, setFavourite] = useState('');
  const [page, setPage] = useState(1);

  const filterKey = JSON.stringify([q, level, route, enrolment, favourite]);
  useEffect(() => setPage(1), [filterKey]);

  const { data, isLoading, isFetching, error, refetch } = useGetApprenticeshipsQuery({
    page,
    limit: MARKETPLACE_PAGE_SIZE,
    ...(q ? { search: q } : {}),
    ...(level ? { level: Number(level) } : {}),
    ...(route ? { route } : {}),
    ...(enrolment ? { enrollment: enrolment as 'enrolled' | 'not_enrolled' } : {}),
    ...(favourite ? { favourite: 'true' as const } : {}),
  });

  const { enrol, isEnrolling } = useEnrol(
    useCallback((enrollmentId: string) => navigation.navigate('LearningWorkspace', { enrollmentId }), [navigation]),
  );
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const hasFilters = Boolean(q || level || route || enrolment || favourite);
  const hasMore = Boolean(data && data.page < data.totalPages);
  const loadMore = () => {
    if (!isFetching && hasMore) setPage((p) => p + 1);
  };

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const openSettings = () => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);

  const onCta = (course: ApprenticeshipSummary) => {
    const cta = enrolCta(course);
    if (cta === 'resume' && course.enrollment) navigation.navigate('LearningWorkspace', { enrollmentId: course.enrollment.id, title: course.title });
    else if (cta === 'enrol') {
      setEnrollingId(course.id);
      void enrol(course.id).finally(() => setEnrollingId(null));
    }
  };

  const header = (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{LEARNING_COPY.marketplaceDescription}</Text>
      <TextField value={search} onChangeText={setSearch} placeholder={LEARNING_COPY.searchPlaceholder} leftIcon="search" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      <View style={styles.pickers}>
        <View style={styles.cell}><PickerField value={level} options={LEVEL_FILTER_OPTIONS} onChange={setLevel} /></View>
        <View style={styles.cell}><PickerField value={enrolment} options={ENROLMENT_FILTER_OPTIONS} onChange={setEnrolment} /></View>
      </View>
      <PickerField value={route} options={ROUTE_FILTER_OPTIONS} onChange={setRoute} searchable />
      <PickerField value={favourite} options={FAVOURITE_FILTER_OPTIONS} onChange={setFavourite} />
      {hasFilters ? (
        <TouchableOpacity
          onPress={() => {
            setSearch('');
            setLevel('');
            setRoute('');
            setEnrolment('');
            setFavourite('');
          }}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>Clear filters</Text>
        </TouchableOpacity>
      ) : null}
      {data ? (
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
          {data.total} apprenticeship{data.total === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Apprenticeships" mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
      <PermissionGate allOf={[LEARNING_PERMISSIONS.USE]} fallback={<EmptyState icon="lock" title="No access" description="Your role does not include Learning." />}>
        <FlatList
          data={error && items.length === 0 ? [] : items}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={header}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading && page === 1 && items.length > 0} onRefresh={() => (page === 1 ? void refetch() : setPage(1))} tintColor={theme.colors.accent} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => {
            const cta = enrolCta(item);
            const tag = enrolmentTag(item);
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('ApprenticeshipDetail', { id: item.id, title: item.title })} accessibilityRole="button" accessibilityLabel={item.title}>
                <Card style={{ gap: 8 }}>
                  <View style={styles.row}>
                    <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, lineHeight: 22 }}>{item.title}</Text>
                    <FavouriteToggle apprenticeshipId={item.id} isFavourite={item.isFavourite} />
                  </View>
                  <View style={styles.wrap}>
                    <Pill label={levelLabel(item.level)} />
                    <Pill label={item.route} />
                    {item.durationMonths ? <Pill label={`${item.durationMonths} months`} /> : null}
                    {tag ? <Pill label={tag} tone="info" /> : null}
                  </View>
                  {item.summary ? (
                    <Text numberOfLines={3} style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{item.summary}</Text>
                  ) : null}
                  <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                    {item.counts.knowledge} knowledge · {item.counts.skills} skills · {item.counts.behaviours} behaviours · {item.counts.duties} duties
                  </Text>
                  <Button
                    label={ENROL_CTA_LABELS[cta]}
                    variant={cta === 'enrol' ? 'primary' : 'outline'}
                    disabled={cta === 'unavailable' || (isEnrolling && enrollingId !== item.id)}
                    loading={isEnrolling && enrollingId === item.id}
                    onPress={() => onCta(item)}
                    fullWidth
                  />
                </Card>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            isLoading ? (
              <Loader label="Loading apprenticeships…" />
            ) : error ? (
              <LearningError error={error} onRetry={() => void refetch()} />
            ) : hasFilters ? (
              <EmptyState icon="search-off" title={LEARNING_COPY.noResultsTitle} description={LEARNING_COPY.noResultsDescription} />
            ) : (
              <EmptyState icon="school" title={LEARNING_COPY.emptyCatalogueTitle} />
            )
          }
          ListFooterComponent={
            items.length > 0 ? (
              <View style={{ paddingTop: 12, gap: 12 }}>
                {isFetching && page > 1 ? <Loader label="Loading more…" /> : hasMore ? <Button label="Load more" variant="outline" onPress={loadMore} fullWidth /> : null}
                <LearningDisclaimer />
              </View>
            ) : null
          }
        />
      </PermissionGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  pickers: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
