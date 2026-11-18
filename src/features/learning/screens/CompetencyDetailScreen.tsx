import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Card, Loader, TextField, useToast } from '@/components/ui';
import type { LearningStackParamList } from '@/navigation/types';
import { getErrorMessage } from '@/services/apiErrorMessage';
import { useAppTheme } from '@/theme/ThemeContext';
import { KeyboardLift } from '@/utils/KeyboardLift';

import { CompetencyStateTag, LearningDisclaimer, LearningError, Pill } from '../components/LearningShared';
import { LEARNING_COPY } from '../learning.data';
import { CONFIDENCE_LABELS, KSB_TYPE_LABELS } from '../learning.logic';
import type { Competency } from '../learning.types';
import {
  useGetAssessmentsQuery,
  useGetCompetenciesQuery,
  useGetEnrollmentQuery,
  useGetEvidenceQuery,
  useOpenCompetencyMutation,
  useSetCompetencyConfidenceMutation,
  useSubmitEvidenceMutation,
} from '../learningApi';

type Nav = NativeStackNavigationProp<LearningStackParamList>;
const SAFE_URL = /^https?:\/\//i;

/**
 * One KSB item of an enrolment. Three things are kept deliberately SEPARATE, as on web: the ASSESSED state
 * (only an assessment can mark an item demonstrated), the learner's own 1–5 confidence (never changes the
 * assessed state), and the evidence they submit (a title, description and optional link — not verified by an
 * assessor). Opening it moves NOT_STARTED to IN_PROGRESS; on a paused or withdrawn course it is view-only.
 */
export function CompetencyDetailScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { enrollmentId, code, statement, readOnly } = useRoute<RouteProp<LearningStackParamList, 'CompetencyDetail'>>().params;

  const enrollment = useGetEnrollmentQuery(enrollmentId);
  const active = enrollment.data?.status === 'ACTIVE' && !readOnly;

  /* Active: opening the item answers with the item. View-only: read it from the list instead (opening would write). */
  const [openItem] = useOpenCompetencyMutation();
  const [opened, setOpened] = useState<Competency | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const didOpen = useRef(false);
  useEffect(() => {
    if (!enrollment.data || !active || didOpen.current) return;
    didOpen.current = true;
    openItem({ enrollmentId, code })
      .unwrap()
      .then(setOpened)
      .catch(setOpenError);
  }, [enrollment.data, active, enrollmentId, code, openItem]);
  const lookup = useGetCompetenciesQuery({ enrollmentId, search: code, limit: 20 }, { skip: !enrollment.data || active });
  const comp: Competency | null = opened ?? lookup.data?.items.find((c) => c.code === code) ?? null;

  const [setConfidence, { isLoading: savingConfidence }] = useSetCompetencyConfidenceMutation();
  const assessments = useGetAssessmentsQuery({ enrollmentId, code });
  const evidenceQuery = useGetEvidenceQuery(enrollmentId);
  const evidence = useMemo(() => (evidenceQuery.data ?? []).filter((x) => x.code === code), [evidenceQuery.data, code]);
  const [submitEvidence, { isLoading: submitting }] = useSubmitEvidenceMutation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [errors, setErrors] = useState<{ title?: string; description?: string; link?: string }>({});

  const back = () => navigation.goBack();
  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={code} mode="stack" onBack={back} />
      <KeyboardLift style={{ flex: 1 }}>{children}</KeyboardLift>
    </View>
  );

  if (enrollment.isLoading) return shell(<Loader fullScreen />);
  if (enrollment.error || !enrollment.data) return shell(<LearningError error={enrollment.error} onRetry={() => void enrollment.refetch()} />);
  if (!comp) {
    const failure = openError ?? lookup.error;
    if (failure) return shell(<LearningError error={failure} onRetry={() => (active ? (didOpen.current = false, setOpenError(null)) : void lookup.refetch())} />);
    return shell(<Loader fullScreen />);
  }

  const heading = (text: string) => <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }}>{text}</Text>;
  const small = (text: string, color: string = theme.colors.textMuted) => <Text style={{ color, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>{text}</Text>;

  const rate = async (n: number) => {
    try {
      const updated = await setConfidence({ enrollmentId, code, selfConfidence: n }).unwrap();
      setOpened(updated);
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not save your rating.'), { tone: 'error' });
    }
  };

  const onSubmitEvidence = async () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Give your evidence a title.';
    if (!description.trim()) next.description = 'Describe what this evidence shows.';
    if (link.trim() && !SAFE_URL.test(link.trim())) next.link = 'A link must start with http:// or https://';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await submitEvidence({ enrollmentId, code, title: title.trim(), description: description.trim(), ...(link.trim() ? { link: link.trim() } : {}) }).unwrap();
      setTitle('');
      setDescription('');
      setLink('');
      toast.show('Evidence submitted.', { tone: 'success' });
    } catch (err) {
      toast.show(getErrorMessage(err as never, 'Could not submit your evidence.'), { tone: 'error' });
    }
  };

  return shell(
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 6 }}>
        <View style={styles.wrap}>
          <Pill label={KSB_TYPE_LABELS[comp.type]} />
          {comp.retired ? <Pill label="Retired in a later version" tone="warning" /> : null}
        </View>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.lg, lineHeight: 26 }}>{comp.statement || statement}</Text>
      </View>

      <Card style={{ gap: 8 }}>
        {heading('Assessed progress')}
        <View style={styles.wrap}>
          <CompetencyStateTag state={comp.state} />
        </View>
        {small(`Attempts: ${comp.attempts}${comp.lastAssessedAt ? ` · last assessed ${new Date(comp.lastAssessedAt).toLocaleDateString('en-GB')}` : ''}${comp.assessedAgainstVersionSeq ? ` · against version ${comp.assessedAgainstVersionSeq}` : ''}`)}
        {small('Only an assessment can mark an item as demonstrated.')}
      </Card>

      <Card style={{ gap: 10 }}>
        {heading('How confident do you feel?')}
        <View style={styles.wrap}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = comp.selfConfidence === n;
            return (
              <TouchableOpacity
                key={n}
                disabled={!active || savingConfidence}
                onPress={() => void rate(n)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !active }}
                accessibilityLabel={`${n}: ${CONFIDENCE_LABELS[n]}`}
                style={[styles.rate, { borderColor: on ? theme.colors.accent : theme.colors.border, backgroundColor: on ? theme.colors.accent : theme.colors.surface, borderRadius: theme.radii.full, opacity: active ? 1 : 0.5 }]}
              >
                <Text style={{ color: on ? theme.colors.textOnAccent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.md }}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {small(comp.selfConfidence ? `${comp.selfConfidence}: ${CONFIDENCE_LABELS[comp.selfConfidence]}` : 'Not rated yet')}
        {small(LEARNING_COPY.selfRatingCaveat)}
      </Card>

      <Card style={{ gap: 8 }}>
        {heading('Assessments')}
        {assessments.isLoading ? (
          <Loader label="Loading…" />
        ) : assessments.error ? (
          <LearningError error={assessments.error} onRetry={() => void assessments.refetch()} />
        ) : (assessments.data ?? []).length === 0 ? (
          small('No assessments yet. Your AI tutor assesses you during a session.')
        ) : (
          (assessments.data ?? []).map((a) => (
            <View key={a.id} style={[styles.sep, { borderTopColor: theme.colors.border }]}>
              <View style={styles.wrap}>
                <Pill label={a.kind.replace(/_/g, ' ').toLowerCase()} />
                <Pill label={`${a.score}/${a.maxScore}`} tone={a.passed ? 'success' : 'warning'} />
                <Pill label={a.passed ? 'Passed' : 'Not passed'} tone={a.passed ? 'success' : 'neutral'} />
              </View>
              {a.feedback ? small(a.feedback, theme.colors.text) : null}
              {small(new Date(a.createdAt).toLocaleDateString('en-GB'))}
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        {heading('Your evidence')}
        {small(LEARNING_COPY.evidenceCaveat)}
        {evidenceQuery.isLoading ? (
          <Loader label="Loading…" />
        ) : evidence.length === 0 ? (
          small('Nothing submitted for this item yet.')
        ) : (
          evidence.map((x) => (
            <View key={x.id} style={[styles.sep, { borderTopColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{x.title}</Text>
              {small(x.description, theme.colors.text)}
              {x.link && SAFE_URL.test(x.link) ? (
                <TouchableOpacity onPress={() => void Linking.openURL(x.link as string)} accessibilityRole="link">
                  <Text style={{ color: theme.colors.accent, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>{x.link}</Text>
                </TouchableOpacity>
              ) : null}
              {small(new Date(x.submittedAt).toLocaleDateString('en-GB'))}
            </View>
          ))
        )}
        {active ? (
          <View style={{ gap: 10 }}>
            <TextField label="Title" value={title} onChangeText={setTitle} error={errors.title} maxLength={200} />
            <TextField label="What does it show?" value={description} onChangeText={setDescription} error={errors.description} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }} maxLength={2000} />
            <TextField label="Link (optional)" value={link} onChangeText={setLink} error={errors.link} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <Button label="Submit evidence" onPress={() => void onSubmitEvidence()} loading={submitting} fullWidth />
          </View>
        ) : (
          small('This course is view-only, so evidence cannot be added.')
        )}
      </Card>

      {active ? (
        <Button
          label="Ask the tutor about this item"
          icon="school"
          onPress={() => navigation.navigate({ name: 'LearningWorkspace', params: { enrollmentId, tab: 'tutor', focusCode: code }, merge: true })}
          fullWidth
        />
      ) : null}
      <LearningDisclaimer />
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rate: { width: 46, height: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
});
