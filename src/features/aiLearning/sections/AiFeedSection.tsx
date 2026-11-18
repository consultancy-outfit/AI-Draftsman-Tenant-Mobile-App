import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, ErrorState, Loader, PickerField, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import {
  AI_CATEGORY_OPTIONS,
  AI_FEED_PAGE_SIZE,
  AI_LEARNING_COPY,
  AI_SEARCH_DEBOUNCE_MS,
  AI_SINCE_OPTIONS,
} from '../aiLearning.data';
import { aiErrorKind, groupByDay } from '../aiLearning.logic';
import type { AiUpdateSummary } from '../aiLearning.types';
import { useGetAiProvidersQuery, useGetAiUpdatesQuery } from '../aiLearningApi';
import { Chip } from '../components/Chip';
import { UpdateCard } from '../components/UpdateCard';
import { useDebouncedValue } from '../useDebouncedValue';

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'update'; key: string; update: AiUpdateSummary };

interface AiFeedSectionProps {
  onOpenUpdate: (update: AiUpdateSummary) => void;
}

/**
 * AI Feed — what changed at AI providers, newest first, grouped by day.
 * Filters: provider chips, category, date, search, Important, Unseen. The
 * list pages by cursor; the API cache (see `aiLearningApi.ts`) accumulates the
 * pages, so this screen only moves the cursor forward and resets it when a
 * filter changes.
 */
export function AiFeedSection({ onOpenUpdate }: AiFeedSectionProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [since, setSince] = useState('');
  const [important, setImportant] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), AI_SEARCH_DEBOUNCE_MS);

  const filterKey = JSON.stringify([provider, category, since, important, unseen, q]);
  /* The cursor belongs to ONE filter set: if the filters moved on, it is stale and ignored. */
  const [cursorState, setCursorState] = useState<{ key: string; cursor?: string }>({ key: filterKey });
  const cursor = cursorState.key === filterKey ? cursorState.cursor : undefined;

  const { data: providers } = useGetAiProvidersQuery();
  const { data, isLoading, isFetching, error, refetch } = useGetAiUpdatesQuery({
    cursor,
    limit: AI_FEED_PAGE_SIZE,
    provider,
    category,
    q,
    since,
    important,
    unseen,
  });

  const items = data?.items;
  const now = useMemo(() => Date.now(), [items]);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const group of groupByDay(items ?? [], (u) => u.publishedAt, now)) {
      out.push({ kind: 'day', key: `day:${group.key}`, label: group.label });
      for (const update of group.items) out.push({ kind: 'update', key: update.id, update });
    }
    return out;
  }, [items, now]);

  const hasFilters = Boolean(provider || category || since || important || unseen || q);
  const kind = error ? aiErrorKind(error) : null;

  const loadMore = useCallback(() => {
    if (isFetching || !data?.hasMore || !data.nextCursor) return;
    setCursorState({ key: filterKey, cursor: data.nextCursor });
  }, [isFetching, data, filterKey]);

  const restart = useCallback(() => {
    if (cursor) setCursorState({ key: filterKey });
    else void refetch();
  }, [cursor, filterKey, refetch]);

  const clearFilters = () => {
    setProvider('');
    setCategory('');
    setSince('');
    setImportant(false);
    setUnseen(false);
    setSearch('');
  };

  const header = (
    <View style={styles.header}>
      <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
        {AI_LEARNING_COPY.feedDescription}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All providers" selected={provider === ''} onPress={() => setProvider('')} />
        {(providers ?? []).map((p) => (
          <Chip
            key={p.slug}
            label={p.name}
            dotColor={p.color || undefined}
            selected={provider === p.slug}
            onPress={() => setProvider(provider === p.slug ? '' : p.slug)}
          />
        ))}
      </ScrollView>

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search updates"
        leftIcon="search"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        {...(search ? { rightIcon: 'close' as const, onRightIconPress: () => setSearch(''), rightIconAccessibilityLabel: 'Clear search' } : {})}
      />

      <View style={styles.pickers}>
        <View style={styles.pickerCell}>
          <PickerField value={category} options={AI_CATEGORY_OPTIONS} onChange={setCategory} placeholder="Category" />
        </View>
        <View style={styles.pickerCell}>
          <PickerField value={since} options={AI_SINCE_OPTIONS} onChange={setSince} placeholder="Date" />
        </View>
      </View>

      <View style={styles.toggles}>
        <Chip label="Important" selected={important} onPress={() => setImportant((v) => !v)} />
        <Chip label="Unseen" selected={unseen} onPress={() => setUnseen((v) => !v)} />
        {hasFilters ? <Chip label="Clear filters" onPress={clearFilters} /> : null}
      </View>
    </View>
  );

  const empty = isLoading ? (
    <Loader label="Loading updates…" />
  ) : error ? (
    kind === 'feed_unavailable' ? (
      <ErrorState title={AI_LEARNING_COPY.unavailableTitle} message={AI_LEARNING_COPY.unavailableDescription} onRetry={restart} />
    ) : (
      <ErrorState title={AI_LEARNING_COPY.loadFailedTitle} message={AI_LEARNING_COPY.loadFailedDescription} onRetry={restart} />
    )
  ) : hasFilters ? (
    <EmptyState
      icon="filter-list-off"
      title={AI_LEARNING_COPY.feedEmptyTitle}
      description={AI_LEARNING_COPY.feedEmptyDescription}
      actionLabel="Clear filters"
      onAction={clearFilters}
    />
  ) : (
    <EmptyState icon="dynamic-feed" title={AI_LEARNING_COPY.feedNothingTitle} description={AI_LEARNING_COPY.feedNothingDescription} />
  );

  return (
    <FlatList
      data={error && rows.length === 0 ? [] : rows}
      keyExtractor={(row) => row.key}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading && !cursor && rows.length > 0} onRefresh={restart} tintColor={theme.colors.accent} />
      }
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        item.kind === 'day' ? (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontFamily: theme.fontFamilies.body.semibold,
              fontSize: theme.fontSizes.xs,
              marginTop: 8,
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {item.label}
          </Text>
        ) : (
          <UpdateCard update={item.update} now={now} onPress={() => onOpenUpdate(item.update)} />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={empty}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        rows.length > 0 ? (
          error ? (
            <View style={styles.footer}>
              <Button label={AI_LEARNING_COPY.retry} variant="outline" onPress={loadMore} fullWidth />
            </View>
          ) : isFetching && cursor ? (
            <Loader label="Loading more…" />
          ) : null
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { gap: 12, marginBottom: 8 },
  chips: { gap: 8, paddingVertical: 2 },
  pickers: { flexDirection: 'row', gap: 10 },
  pickerCell: { flex: 1 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingVertical: 16 },
});
