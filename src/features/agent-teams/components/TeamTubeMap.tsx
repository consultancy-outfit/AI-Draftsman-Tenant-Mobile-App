import { useMemo, useState, type ReactNode } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Icon, Loader, TextField } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { useGetAgentTeamMapQuery } from '../agentTeamsApi';
import { TEAM_STAGES, TUBE_COPY, buildTubeModel, filterTubeLines, type TubeLine } from '../agentTeamsRules';
import { TagChip } from './TagChip';
import { lineColour } from '../metroLayout';
import { MetroMap } from './MetroMap';
import { TubeDetailSheet, type TubeSelection } from './TubeDetailSheet';

/** One colour per line, cycled — the tube map's line colours. */

interface TeamTubeMapProps {
  /** The screen's own header block (the Team list / Tube map toggle). */
  header: ReactNode;
  onOpenTeam: (teamId: string, name: string) => void;
}

/**
 * The Agents Teams tube map (design view) — web's `TeamTubeMap`, rebuilt
 * for a phone. Web draws every team as a horizontal line across seven
 * stage columns on a wide SVG canvas; a 390pt screen cannot hold that, so
 * here each team is a vertical line of its own, its stops grouped by the
 * same seven stages. What the canvas encoded is kept: a stop shared by
 * several teams is an interchange (a ringed dot and a "Shared by N" tag), a
 * stop that needs a look is drawn hollow and dashed, and tapping a stop or a
 * team opens the same details web shows in its side panel.
 */
export function TeamTubeMap({ header, onOpenTeam }: TeamTubeMapProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<TubeSelection>(null);
  /* The followed line: highlighted on the map, and the only card below. */
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [fsMapH, setFsMapH] = useState(0);
  const { height: winH } = useWindowDimensions();

  const { data, isLoading, isFetching, isError, refetch } = useGetAgentTeamMapQuery(undefined, { refetchOnMountOrArgChange: true });

  const model = useMemo(() => (data ? buildTubeModel(data.teams ?? []) : null), [data]);
  const linesById = useMemo(() => new Map((model?.lines ?? []).map((l) => [l.id, l])), [model]);
  const lines = useMemo(() => filterTubeLines(model?.lines ?? [], search), [model, search]);
  /* Same colour per team on the map, the legend and the cards. */
  const colourOf = (lineId: string) => lineColour(Math.max(0, (model?.lines ?? []).findIndex((l) => l.id === lineId)));
  const shownLines = focusLineId ? lines.filter((l) => l.id === focusLineId) : lines;
  const toggleFocus = (id: string) => setFocusLineId((cur) => (cur === id ? null : id));

  const renderLine = (line: TubeLine) => {
    const colour = colourOf(line.id);
    return (
      <View key={line.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
        <TouchableOpacity onPress={() => setSelection({ kind: 'line', line })} style={styles.lineHeader} accessibilityRole="button" accessibilityLabel={`Details for ${line.name}`}>
          <View style={[styles.lineSwatch, { backgroundColor: colour }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
              {line.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs }}>
              {line.team.members.length} member{line.team.members.length === 1 ? '' : 's'} · revision {line.team.revision}
            </Text>
          </View>
          <Icon name="info-outline" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {TEAM_STAGES.slice(1).map((stage) => {
          const stops = line.stops.filter((s) => s.stage === stage.key);
          if (stops.length === 0) return null;
          return (
            <View key={stage.key}>
              <Text style={[styles.stageLabel, { color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold }]}>{stage.label.toUpperCase()}</Text>
              {stops.map((s) => {
                const station = model?.stations.get(s.id);
                const dashed = s.dashed;
                const interchange = station?.isInterchange ?? false;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => station && setSelection({ kind: 'station', station })}
                    style={styles.stopRow}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.label}${dashed ? ', needs a look' : ''}`}
                  >
                    <View style={styles.rail}>
                      <View style={[styles.railLine, { backgroundColor: colour }]} />
                      <View
                        style={[
                          interchange ? styles.dotInterchange : styles.dot,
                          {
                            borderColor: colour,
                            backgroundColor: dashed ? theme.colors.surface : interchange ? theme.colors.surface : colour,
                            borderStyle: dashed ? 'dashed' : 'solid',
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.stopText}>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }} numberOfLines={2}>
                        {s.label}
                      </Text>
                      {s.sublabel ? <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{s.sublabel}</Text> : null}
                    </View>
                    {interchange && station && <TagChip label={`Shared by ${station.lineIds.length}`} tone="accent" />}
                    {dashed && <TagChip label="Needs a look" tone="warning" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  let content: ReactNode;
  if (isLoading) {
    content = <Loader label="Loading the tube map…" />;
  } else if (isError) {
    content = <ErrorState title={TUBE_COPY.errorTitle} message={TUBE_COPY.errorMessage} retryLabel="Try again" onRetry={() => void refetch()} />;
  } else if ((model?.lines.length ?? 0) === 0) {
    content = <EmptyState icon="account-tree" title={TUBE_COPY.emptyTitle} description={TUBE_COPY.emptyDescription} />;
  } else {
    content = (
      <>
        {/* The drawn map — the shape of every team at a glance. */}
        <View style={[styles.mapCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
          <View style={styles.mapHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>Metro map</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.xs, marginTop: 2 }}>
                {model!.lines.length} team{model!.lines.length === 1 ? '' : 's'} · each line runs left to right
              </Text>
            </View>
            <TouchableOpacity onPress={() => setFullScreen(true)} style={[styles.fsBtn, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]} accessibilityRole="button" accessibilityLabel="Open the map full screen">
              <Icon name="open-in-full" size={16} color={theme.colors.text} />
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: 12 }}>Full screen</Text>
            </TouchableOpacity>
          </View>
          <MetroMap
            model={model!}
            focusLineId={focusLineId}
            height={340}
            onPressStation={(station) => setSelection({ kind: 'station', station })}
            onPressLine={toggleFocus}
          />

          {/* Legend — tap a team to follow its line. */}
          <Text style={[styles.legendTitle, { color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold }]}>FOLLOW A TEAM</Text>
          <View style={styles.legend}>
            {model!.lines.map((l) => {
              const on = focusLineId === l.id;
              const colour = colourOf(l.id);
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => toggleFocus(l.id)}
                  style={[styles.legendChip, { borderColor: on ? colour : theme.colors.border, backgroundColor: on ? colour + '1A' : theme.colors.surface, borderRadius: theme.radii.full }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${on ? 'Stop following' : 'Follow'} ${l.name}`}
                >
                  <View style={[styles.legendSwatch, { backgroundColor: colour }]} />
                  <Text style={{ color: theme.colors.text, fontFamily: on ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium, fontSize: 12 }} numberOfLines={1}>
                    {l.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Key */}
          <View style={[styles.key, { borderTopColor: theme.colors.border }]}>
            <View style={styles.keyItem}>
              <View style={[styles.keyDot, { borderColor: theme.colors.text }]} />
              <Text style={[styles.keyText, { color: theme.colors.textMuted }]}>One team</Text>
            </View>
            <View style={styles.keyItem}>
              <View style={[styles.keyPill, { borderColor: theme.colors.text }]} />
              <Text style={[styles.keyText, { color: theme.colors.textMuted }]}>Shared by 2–4</Text>
            </View>
            <View style={styles.keyItem}>
              <View style={[styles.keyHub, { borderColor: theme.colors.text }]}>
                <Text style={{ fontSize: 8, fontWeight: '700', color: theme.colors.text }}>7</Text>
              </View>
              <Text style={[styles.keyText, { color: theme.colors.textMuted }]}>Hub (5+)</Text>
            </View>
            <View style={styles.keyItem}>
              <View style={[styles.keyDot, { borderColor: theme.colors.text, borderStyle: 'dashed' }]} />
              <Text style={[styles.keyText, { color: theme.colors.textMuted }]}>Needs a look</Text>
            </View>
          </View>
        </View>

        {/* Journeys — the readable detail, one card per team. */}
        <View style={styles.journeysHead}>
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>
            {focusLineId ? 'Following' : 'Journeys'}
          </Text>
          {focusLineId ? (
            <TouchableOpacity onPress={() => setFocusLineId(null)} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: 13 }}>Show all teams</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {!focusLineId ? (
          <TextField placeholder={TUBE_COPY.searchPlaceholder} leftIcon="search" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
        ) : null}
        {shownLines.length === 0 ? <EmptyState icon="search-off" title="No matches" description={TUBE_COPY.noMatches} /> : shownLines.map(renderLine)}
      </>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
      >
        {header}
        {content}
      </ScrollView>
      {model ? (
        <Modal visible={fullScreen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setFullScreen(false)}>
          <View style={{ flex: 1, backgroundColor: theme.colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View style={styles.fsHeader}>
              <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg }}>Metro map</Text>
              <TouchableOpacity onPress={() => setFullScreen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close full screen">
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 8 }} onLayout={(e) => setFsMapH(Math.floor(e.nativeEvent.layout.height))}>
              <MetroMap
                model={model}
                focusLineId={focusLineId}
                fitTo="height"
                height={fsMapH > 0 ? fsMapH : Math.max(300, winH - insets.top - insets.bottom - 140)}
                onPressStation={(station) => setSelection({ kind: 'station', station })}
                onPressLine={toggleFocus}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fsLegendBar} contentContainerStyle={styles.fsLegend}>
              {model.lines.map((l) => {
                const on = focusLineId === l.id;
                const colour = colourOf(l.id);
                return (
                  <TouchableOpacity key={l.id} onPress={() => toggleFocus(l.id)} style={[styles.legendChip, styles.fsChip, { borderColor: on ? colour : theme.colors.border, backgroundColor: on ? colour + '1A' : theme.colors.surface, borderRadius: theme.radii.full }]}>
                    <View style={[styles.legendSwatch, { backgroundColor: colour }]} />
                    <Text style={{ color: theme.colors.text, fontSize: 12, fontFamily: on ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium }}>{l.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          {/* The stop/line sheet must open INSIDE this modal to show above it. */}
          <TubeDetailSheet
            selection={selection}
            linesById={linesById}
            stationsById={model.stations}
            onClose={() => setSelection(null)}
            onFollow={(lineId) => {
              setFocusLineId(lineId);
              setSelection(null);
            }}
            onOpenTeam={(id, name) => {
              setSelection(null);
              setFullScreen(false);
              onOpenTeam(id, name);
            }}
          />
        </Modal>
      ) : null}
      <TubeDetailSheet
        selection={fullScreen ? null : selection}
        linesById={linesById}
        stationsById={model?.stations ?? new Map()}
        onClose={() => setSelection(null)}
        onFollow={(lineId) => {
          /* Follow = highlight it on the map and show only its journey. */
          setFocusLineId(lineId);
          setSelection(null);
        }}
        onOpenTeam={(id, name) => {
          setSelection(null);
          onOpenTeam(id, name);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  mapCard: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  mapHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  fsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  legendTitle: { fontSize: 10, letterSpacing: 0.6, marginTop: 2, paddingHorizontal: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  legendSwatch: { width: 14, height: 4, borderRadius: 2 },
  key: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 2 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyText: { fontSize: 11 },
  keyDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  keyPill: { width: 9, height: 16, borderRadius: 5, borderWidth: 2 },
  keyHub: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  journeysHead: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  fsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  /* flexGrow 0: a horizontal ScrollView otherwise takes a share of the
   * column's height and stretches every chip to it (the giant pills). */
  fsLegendBar: { flexGrow: 0, flexShrink: 0 },
  fsLegend: { gap: 8, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  fsChip: { alignSelf: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  lineSwatch: { width: 6, height: 32, borderRadius: 3 },
  stageLabel: { fontSize: 10, letterSpacing: 0.6, marginTop: 10, marginBottom: 2, marginLeft: 30 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  rail: { width: 22, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  dotInterchange: { width: 18, height: 18, borderRadius: 9, borderWidth: 4 },
  stopText: { flex: 1, minWidth: 0, paddingVertical: 6 },
});
