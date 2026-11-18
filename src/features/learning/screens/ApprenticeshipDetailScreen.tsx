import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Icon, Loader, StatusTabs } from '@/components/ui';
import type { LearningStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme/ThemeContext';

import { FavouriteToggle } from '../components/FavouriteToggle';
import { LearningDisclaimer, LearningError, Pill, SafetyNotice } from '../components/LearningShared';
import { KSB_PAGE_SIZE, LEARNING_COPY } from '../learning.data';
import { ENROL_CTA_LABELS, enrolCta, enrolmentTag, hasItems, ksbTypeTabs, levelLabel } from '../learning.logic';
import type { KsbType } from '../learning.types';
import { useGetApprenticeshipChangelogQuery, useGetApprenticeshipKsbsQuery, useGetApprenticeshipQuery } from '../learningApi';
import { useEnrol } from '../useEnrol';

type Nav = NativeStackNavigationProp<LearningStackParamList>;

const SAFE_URL = /^https?:\/\//i;

/**
 * One apprenticeship — read-only: overview, what you will learn, prerequisites, the KSBs (by type, paged),
 * how the AI tutor teaches it, the published version with its changelog, and the sources and licence.
 * Enrol / Resume sits at the top. A withdrawn or unpublished course says so and cannot be enrolled in.
 */
export function ApprenticeshipDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { id, title } = useRoute<RouteProp<LearningStackParamList, 'ApprenticeshipDetail'>>().params;
  const { data, isLoading, error, refetch } = useGetApprenticeshipQuery(id);
  const back = () => navigation.goBack();

  const { enrol, isEnrolling } = useEnrol(useCallback((enrollmentId: string) => navigation.navigate('LearningWorkspace', { enrollmentId }), [navigation]));

  const tabs = data ? ksbTypeTabs(data.counts) : [];
  const [ksbType, setKsbType] = useState<KsbType | null>(null);
  useEffect(() => {
    if (!ksbType && tabs[0]) setKsbType(tabs[0].type);
  }, [tabs, ksbType]);
  const [ksbPage, setKsbPage] = useState(1);
  useEffect(() => setKsbPage(1), [ksbType]);
  const ksbs = useGetApprenticeshipKsbsQuery({ apprenticeshipId: id, ...(ksbType ? { type: ksbType } : {}), page: ksbPage, limit: KSB_PAGE_SIZE }, { skip: !data || !ksbType });

  const [showChangelog, setShowChangelog] = useState(false);
  const changelog = useGetApprenticeshipChangelogQuery(id, { skip: !showChangelog });

  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={data?.title ?? title ?? 'Apprenticeship'} mode="stack" onBack={back} />
      {children}
    </View>
  );

  if (isLoading) return shell(<Loader fullScreen />);
  if (error || !data) return shell(<LearningError error={error} onRetry={() => void refetch()} />);

  const cta = enrolCta(data);
  const tag = enrolmentTag(data);
  const heading = (text: string) => <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{text}</Text>;
  const body = (text: string) => <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{text}</Text>;
  const bullets = (list: string[]) => (
    <View style={{ gap: 6 }}>
      {list.map((t, i) => (
        <View key={`${i}-${t}`} style={styles.bullet}>
          <Text style={{ color: theme.colors.textMuted }}>•</Text>
          <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
  const open = (url: string | null) => {
    if (url && SAFE_URL.test(url)) void Linking.openURL(url);
  };
  const ksbItems = ksbs.data?.items ?? [];
  const ksbMore = Boolean(ksbs.data && ksbs.data.page < ksbs.data.totalPages);

  return shell(
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.titleRow}>
        <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fontFamilies.display.bold, fontSize: theme.fontSizes.xl, lineHeight: 30 }}>{data.title}</Text>
        <FavouriteToggle apprenticeshipId={data.id} isFavourite={data.isFavourite} />
      </View>
      <View style={styles.wrap}>
        <Pill label={levelLabel(data.level)} />
        <Pill label={data.route} />
        {data.pathway ? <Pill label={data.pathway} /> : null}
        {data.durationMonths ? <Pill label={`${data.durationMonths} months`} /> : null}
        <Pill label={data.ref} />
        {tag ? <Pill label={tag} tone="info" /> : null}
      </View>

      {cta === 'unavailable' ? (
        <View style={[styles.note, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.lg }]}>
          <Icon name="block" size={18} color={theme.colors.statusWarningFg} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{LEARNING_COPY.unavailableTitle}</Text>
            <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{LEARNING_COPY.unavailableDescription}</Text>
          </View>
        </View>
      ) : null}
      <Button
        label={ENROL_CTA_LABELS[cta]}
        variant={cta === 'enrol' ? 'primary' : 'outline'}
        disabled={cta === 'unavailable'}
        loading={isEnrolling}
        onPress={() => {
          if (cta === 'resume' && data.enrollment) navigation.navigate('LearningWorkspace', { enrollmentId: data.enrollment.id, title: data.title });
          else if (cta === 'enrol') void enrol(data.id);
        }}
        fullWidth
      />

      {data.safetyNotice ? <SafetyNotice text={data.safetyNotice} /> : null}

      {data.overview || data.summary ? (
        <Card style={{ gap: 8 }}>
          {heading('Overview')}
          {body(data.overview || data.summary)}
        </Card>
      ) : null}

      {hasItems(data.learningOutcomes) ? (
        <Card style={{ gap: 8 }}>
          {heading('What you will learn to do')}
          {bullets(data.learningOutcomes)}
        </Card>
      ) : null}

      {hasItems(data.prerequisites) ? (
        <Card style={{ gap: 8 }}>
          {heading('Prerequisites')}
          {bullets(data.prerequisites)}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        {heading('Knowledge, skills, behaviours and duties')}
        {tabs.length === 0 ? (
          body('No items are published for this apprenticeship yet.')
        ) : (
          <>
            <StatusTabs tabs={tabs.map((t) => ({ value: t.type, label: `${t.label} · ${t.count}` }))} value={ksbType ?? tabs[0]?.type ?? ''} onChange={(v) => setKsbType(v as KsbType)} />
            {ksbs.isLoading ? (
              <Loader label="Loading…" />
            ) : ksbs.error ? (
              <LearningError error={ksbs.error} onRetry={() => void ksbs.refetch()} />
            ) : (
              ksbItems.map((k) => (
                <View key={k.code} style={[styles.ksb, { borderTopColor: theme.colors.border }]}>
                  <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{k.code}</Text>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>{k.statement}</Text>
                  {k.aiOnTheJob?.whatChanges ? (
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
                      <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>AI on the job: </Text>
                      {k.aiOnTheJob.whatChanges}
                    </Text>
                  ) : null}
                  {k.aiInTraining?.howAiHelpsLearning ? (
                    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
                      <Text style={{ fontFamily: theme.fontFamilies.body.semibold }}>AI in training: </Text>
                      {k.aiInTraining.howAiHelpsLearning}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
            {ksbMore ? <Button label="Load more" variant="outline" loading={ksbs.isFetching} onPress={() => setKsbPage((p) => p + 1)} fullWidth /> : null}
          </>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        {heading('Your AI tutor')}
        {body(data.orchestrator.description)}
        {data.orchestrator.specialistCounts.specialists > 0 ? body(`${data.orchestrator.specialistCounts.specialists} specialist tutors cover this apprenticeship.`) : null}
        {data.teachingApproach ? body(data.teachingApproach) : null}
      </Card>

      <Card style={{ gap: 8 }}>
        {heading('Version')}
        {data.publishedVersion ? (
          <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>
            Version {data.publishedVersion.seq} · standard {data.publishedVersion.standardVersion} · published {new Date(data.publishedVersion.publishedAt).toLocaleDateString('en-GB')}
          </Text>
        ) : (
          body('No version is published.')
        )}
        {data.lastSuccessfulRefreshAt ? body(`Last refreshed ${new Date(data.lastSuccessfulRefreshAt).toLocaleDateString('en-GB')}.`) : null}
        <TouchableOpacity onPress={() => setShowChangelog((v) => !v)} accessibilityRole="button">
          <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{showChangelog ? 'Hide changelog' : 'Show changelog'}</Text>
        </TouchableOpacity>
        {showChangelog ? (
          changelog.isLoading ? (
            <Loader label="Loading…" />
          ) : changelog.error ? (
            <LearningError error={changelog.error} onRetry={() => void changelog.refetch()} />
          ) : (changelog.data ?? []).length === 0 ? (
            body('No changes recorded yet.')
          ) : (
            (changelog.data ?? []).map((e) => (
              <View key={e.versionSeq} style={[styles.ksb, { borderTopColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
                  Version {e.versionSeq} · {e.standardVersion} · {new Date(e.publishedAt).toLocaleDateString('en-GB')}
                </Text>
                {e.summary ? body(e.summary) : null}
                {e.changes.slice(0, 12).map((c, i) => (
                  <Text key={`${i}-${c.code ?? ''}`} style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
                    {c.kind.replace(/_/g, ' ').toLowerCase()}
                    {c.code ? ` · ${c.code}` : ''}
                    {c.note ? ` — ${c.note}` : ''}
                  </Text>
                ))}
                {e.changes.length > 12 ? body(`…and ${e.changes.length - 12} more.`) : null}
              </View>
            ))
          )
        ) : null}
      </Card>

      <Card style={{ gap: 8 }}>
        {heading('Sources and licence')}
        {data.standardUrl ? (
          <TouchableOpacity onPress={() => open(data.standardUrl)} accessibilityRole="link">
            <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>The official standard</Text>
          </TouchableOpacity>
        ) : null}
        {data.sources.map((s, i) =>
          s.url && SAFE_URL.test(s.url) ? (
            <TouchableOpacity key={`${i}-${s.label}`} onPress={() => open(s.url)} accessibilityRole="link">
              <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{s.label}</Text>
            </TouchableOpacity>
          ) : (
            <Text key={`${i}-${s.label}`} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm }}>{s.label}</Text>
          ),
        )}
        {data.licence ? body(data.licence) : null}
      </Card>

      <LearningDisclaimer />
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bullet: { flexDirection: 'row', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
  ksb: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
});
