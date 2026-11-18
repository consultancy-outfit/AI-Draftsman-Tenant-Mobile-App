import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, EmptyState, ErrorState, Loader, StatusTabs, TextField, useToast } from '@/components/ui';
import { useDebouncedValue } from '@/features/marketplace/useDebouncedValue';
import type { AgentTeamsStackParamList } from '@/navigation/types';
import { AGENT_TEAM_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';

import { AGENT_TEAMS_PAGE_SIZE, useDeleteAgentTeamMutation, useGetAgentTeamsQuery } from './agentTeamsApi';
import {
  AGENT_TEAMS_COPY,
  DELETE_TEAM_COPY,
  SEARCH_DEBOUNCE_MS,
  chatBlockedReason,
  teamChatTarget,
  toAgentTeamRow,
  type AgentTeamRow,
} from './agentTeamsRules';
import { AgentTeamCard } from './components/AgentTeamCard';
import { TeamTubeMap } from './components/TeamTubeMap';
import { openNewTeamChat, openTeamConversation } from './openTeamConversation';

type Nav = NativeStackNavigationProp<AgentTeamsStackParamList>;
type View_ = 'list' | 'map';

const VIEW_TABS = [
  { value: 'list', label: 'Team list' },
  { value: 'map', label: 'Tube map' },
];

/**
 * Agents Teams — the list screen, ported from web's `AgentTeams` +
 * `useAgentTeams`. Both kinds of team are listed: one assembled here
 * (`BUILDER`) and the roster a team chat minted (`THREAD`, tagged
 * "From chat"). The Tube map takes the list's place rather than opening
 * over it, exactly as on web.
 */
export function AgentTeamsScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const canView = usePermission(AGENT_TEAM_PERMISSIONS.VIEW);
  const canBuild = usePermission(AGENT_TEAM_PERMISSIONS.BUILD);
  const canDelete = usePermission(AGENT_TEAM_PERMISSIONS.DELETE);

  const [view, setView] = useState<View_>('list');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  /*
   * A growing, server-paginated list — the same "Load more" pattern as
   * Customers, Lead criteria, Reports and Support. Each page is its own
   * cache entry (offset-paged `?page=`), and the rows already shown are
   * accumulated here; page 1 always REPLACES them, so a refresh or a
   * changed search starts the list again rather than appending to it.
   */
  const [page, setPage] = useState(1);
  const [loadedRows, setLoadedRows] = useState<AgentTeamRow[]>([]);

  /* Changing the search goes back to page one. */
  useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching, error, refetch } = useGetAgentTeamsQuery(
    { search: debouncedSearch || undefined, page, limit: AGENT_TEAMS_PAGE_SIZE },
    { skip: !canView || view !== 'list' },
  );
  const [deleteTeam, { isLoading: isDeleting }] = useDeleteAgentTeamMutation();

  useEffect(() => {
    if (!data) return;
    const incoming = data.items.map(toAgentTeamRow);
    setLoadedRows((prev) => {
      if (data.page <= 1) return incoming;
      /* A later page: append what is new, and refresh any row already
         shown (an edit invalidates the page it was on). */
      const byId = new Map(incoming.map((r) => [r.id, r]));
      const kept = prev.map((r) => byId.get(r.id) ?? r);
      const seen = new Set(prev.map((r) => r.id));
      return [...kept, ...incoming.filter((r) => !seen.has(r.id))];
    });
  }, [data]);

  /* Back from New team / Edit / New team chat: start again from page one,
     so a created team (which lands at the top) and an edited one both show.
     Skipped on the screen's first focus. */
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocused.current) {
        hasFocused.current = true;
        return;
      }
      setPage(1);
    }, []),
  );

  const rows = loadedRows;
  /* Read off the RESPONSE, never counted from the rows on screen. */
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? 1);

  const handleRefresh = () => {
    setPage(1);
    void refetch();
  };

  const handleLoadMore = () => {
    if (isFetching || page >= pageCount) return;
    setPage((p) => p + 1);
  };

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const openSettings = () => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);

  const handleNewTeam = () => navigation.navigate('AgentTeamForm', {});
  /* Into the Chat module, as on web — not a form of this module's own. */
  const handleNewTeamChat = () => openNewTeamChat(navigation as never);

  const handleChat = (row: AgentTeamRow) => {
    const blocked = chatBlockedReason(row);
    if (blocked) {
      toast.show(blocked, { tone: 'warning' });
      return;
    }
    const target = teamChatTarget(row);
    if (target.kind === 'thread') {
      openTeamConversation(navigation, target.conversationId, row.name);
    } else {
      openNewTeamChat(navigation as never, target.agentIds);
    }
  };

  const handleEdit = (row: AgentTeamRow) => {
    if (!canBuild || !row.canEditTeam) {
      toast.show(canBuild ? AGENT_TEAMS_COPY.noEditThisTeam : AGENT_TEAMS_COPY.noEditPermission, { tone: 'warning' });
      return;
    }
    navigation.navigate('AgentTeamForm', { id: row.id });
  };

  const handleDelete = (row: AgentTeamRow) => {
    if (!canDelete || !row.canDeleteTeam) {
      toast.show(canDelete ? AGENT_TEAMS_COPY.noDeleteThisTeam : AGENT_TEAMS_COPY.noDeletePermission, { tone: 'warning' });
      return;
    }
    Alert.alert(DELETE_TEAM_COPY.title(row.name), DELETE_TEAM_COPY.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: DELETE_TEAM_COPY.confirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTeam(row.id).unwrap();
            toast.show(`${row.name} deleted.`, { tone: 'success' });
            /* Gone from the rows already shown at once, and the list starts
               again from page one so the offsets behind it line up. */
            setLoadedRows((prev) => prev.filter((r) => r.id !== row.id));
            setPage(1);
          } catch (err) {
            toast.show(getErrorMessage(err as never, 'Could not delete that team.'), { tone: 'error' });
          }
        },
      },
    ]);
  };

  const openTeam = (id: string, name?: string) => navigation.navigate('AgentTeamDetail', { id, name });

  if (!canView) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={AGENT_TEAMS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
        <View style={{ padding: 16 }}>
          <EmptyState icon="lock" title={AGENT_TEAMS_COPY.noViewTitle} description={AGENT_TEAMS_COPY.noViewDescription} />
        </View>
      </View>
    );
  }

  const topBlock = (
    <View style={styles.headerBlock}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        {AGENT_TEAMS_COPY.subtitle}
      </Text>
      <StatusTabs tabs={VIEW_TABS} value={view} onChange={(v) => setView(v as View_)} />
    </View>
  );

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={AGENT_TEAMS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
        <TeamTubeMap header={topBlock} onOpenTeam={openTeam} />
      </View>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      {topBlock}
      {canBuild && (
        <View style={styles.ctaRow}>
          {/* Narrower side padding than the Button default: at md size two
              buttons side by side otherwise outgrow a phone's width. */}
          <Button label="New team" icon="add" onPress={handleNewTeam} style={styles.cta} />
          <Button label="New team chat" icon="forum" variant="outline" onPress={handleNewTeamChat} style={styles.cta} />
        </View>
      )}
      <TextField placeholder="Search teams" leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
        {!isLoading && !error ? `${total} team${total === 1 ? '' : 's'}` : 'Teams'}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={AGENT_TEAMS_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />

      <FlatList
        data={error ? [] : rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading && page === 1} onRefresh={handleRefresh} tintColor={theme.colors.accent} />}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <AgentTeamCard
            row={item}
            canBuild={canBuild}
            canDelete={canDelete}
            onOpen={() => openTeam(item.id, item.name)}
            onChat={() => handleChat(item)}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <Loader label="Loading teams…" />
          ) : error ? (
            <ErrorState title="Could not load teams" message={getErrorMessage(error as never, 'Your teams did not come back. Try again in a moment.')} onRetry={refetch} />
          ) : debouncedSearch ? (
            <EmptyState icon="search-off" title={AGENT_TEAMS_COPY.emptyTitle} description="No team matches that search. Try a different name." />
          ) : (
            <EmptyState
              icon="account-tree"
              title={AGENT_TEAMS_COPY.emptyTitle}
              description={AGENT_TEAMS_COPY.emptyDescription}
              actionLabel={canBuild ? 'New team' : undefined}
              onAction={canBuild ? handleNewTeam : undefined}
            />
          )
        }
        ListFooterComponent={
          !isLoading && !error && rows.length > 0 && page < pageCount ? (
            <View style={styles.pager}>
              <Button label="Load more" variant="outline" loading={isFetching} onPress={handleLoadMore} fullWidth />
            </View>
          ) : null
        }
      />
      {isDeleting && <Loader fullScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerBlock: { gap: 12, marginBottom: 12 },
  ctaRow: { flexDirection: 'row', gap: 10 },
  cta: { flex: 1, paddingHorizontal: 10 },
  pager: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 8 },
});
