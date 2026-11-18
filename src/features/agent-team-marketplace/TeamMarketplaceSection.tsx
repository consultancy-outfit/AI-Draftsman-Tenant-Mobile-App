import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Loader, StatusTabs, TextField } from '@/components/ui';
import { Chip } from '@/features/aiLearning/components/Chip';
import { useAppTheme } from '@/theme/ThemeContext';

import { OwnedTeamCard, TeamCard } from './components/TeamCard';
import { useInstalledTemplates } from './useTeamCatalogue';
import { useGetMarketplaceTeamsQuery } from './teamMarketplaceApi';
import { TEAM_CATALOGUE_LIMIT, TEAM_COPY, TEAM_SEARCH_DEBOUNCE_MS } from './teamMarketplace.data';
import { ALL_CATEGORIES, chipLabel, groupHeading, groupTeamsByCategory, visibleGroups } from './teamMarketplaceGroups';
import type { MarketplaceTeam } from './teamMarketplace.types';
import { useDebouncedValue } from '../marketplace/useDebouncedValue';

type Mode = 'catalogue' | 'mine';
type Row = { kind: 'heading'; key: string; text: string } | { kind: 'team'; key: string; team: MarketplaceTeam };

interface TeamMarketplaceSectionProps {
  onOpenTemplate: (id: string) => void;
  /** Opens one of this workspace's own teams (the Agents Teams detail screen). */
  onOpenTeam: (id: string, name?: string) => void;
}

/**
 * The Agent Teams tab of the Marketplace: "Marketplace" (platform templates, grouped by category, with
 * search and category chips) and "My teams" (this workspace's own built teams). Installing is done from a
 * template's detail screen.
 */
export function TeamMarketplaceSection({ onOpenTemplate, onOpenTeam }: TeamMarketplaceSectionProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('catalogue');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), TEAM_SEARCH_DEBOUNCE_MS);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const list = useGetMarketplaceTeamsQuery({ page: 1, limit: TEAM_CATALOGUE_LIMIT, ...(q ? { search: q } : {}) });
  const installed = useInstalledTemplates();

  const groups = useMemo(() => groupTeamsByCategory(list.data?.items ?? []), [list.data]);
  const shown = useMemo(() => visibleGroups(groups, category), [groups, category]);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of shown) {
      out.push({ kind: 'heading', key: `h:${g.key}`, text: groupHeading(g) });
      for (const t of g.teams) out.push({ kind: 'team', key: t.id, team: t });
    }
    return out;
  }, [shown]);

  const tabs = (
    <View style={styles.tabs}>
      <StatusTabs
        tabs={[
          { value: 'catalogue', label: TEAM_COPY.catalogueLabel },
          { value: 'mine', label: `${TEAM_COPY.ownedLabel}${installed.workspaceTeams.length ? ` · ${installed.workspaceTeams.length}` : ''}` },
        ]}
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      />
    </View>
  );

  if (mode === 'mine') {
    return (
      <FlatList
        data={installed.workspaceTeams}
        keyExtractor={(t) => t.id}
        removeClippedSubviews={false}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={tabs}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void installed.refetch()} tintColor={theme.colors.accent} />}
        renderItem={({ item }) => (
          <OwnedTeamCard team={item} onPress={() => onOpenTeam(item.id, item.name)} />
        )}
        ListEmptyComponent={
          installed.isLoading ? <Loader label="Loading your teams…" /> : <EmptyState icon="account-tree" title={TEAM_COPY.ownedEmptyTitle} description={TEAM_COPY.ownedEmptyDescription} />
        }
      />
    );
  }

  const header = (
    <View style={{ gap: 12 }}>
      {tabs}
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{TEAM_COPY.catalogueLead}</Text>
      <TextField value={search} onChangeText={setSearch} placeholder={TEAM_COPY.searchPlaceholder} leftIcon="search" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      {groups.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={category === ALL_CATEGORIES} onPress={() => setCategory(ALL_CATEGORIES)} />
          {groups.map((g) => (
            <Chip key={g.key} label={chipLabel(g)} selected={category === g.key} onPress={() => setCategory(g.key)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={list.error ? [] : rows}
      keyExtractor={(r) => r.key}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      refreshControl={<RefreshControl refreshing={list.isFetching && !list.isLoading} onRefresh={() => void list.refetch()} tintColor={theme.colors.accent} />}
      renderItem={({ item }) =>
        item.kind === 'heading' ? (
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.text}</Text>
        ) : (
          <TeamCard team={item.team} installed={Boolean(installed.installedIds[item.team.id])} onPress={() => onOpenTemplate(item.team.id)} />
        )
      }
      ListEmptyComponent={
        list.isLoading ? (
          <Loader label="Loading teams…" />
        ) : list.error ? (
          <ErrorState title={TEAM_COPY.errorTitle} message={TEAM_COPY.errorDescription} onRetry={() => void list.refetch()} />
        ) : q ? (
          <EmptyState icon="search-off" title={TEAM_COPY.noMatchTitle} description={TEAM_COPY.noMatchDescription} />
        ) : (
          <EmptyState icon="account-tree" title={TEAM_COPY.emptyTitle} description={TEAM_COPY.emptyDescription} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  tabs: { marginBottom: 4 },
  chips: { gap: 8, paddingVertical: 2 },
});
