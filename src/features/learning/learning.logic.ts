/**
 * =============================================================================
 * LEARNING — the pure rules behind every Learning screen
 * =============================================================================
 * What a card's button says, what an enrol result means, how a competency state
 * is labelled, when the tutor panel polls and what a failed send is allowed to
 * show. No React, no store, no network — `tools/checks/learning-state.spec.ts`
 * imports this file by relative path under `node --experimental-strip-types`.
 *
 * ── TWO NUMBERS THAT ARE NEVER ONE ───────────────────────────────────────────
 * `state` is what an assessment showed; `selfConfidence` is what the learner
 * says. Nothing here derives one from the other, and the labels keep them apart.
 *
 * ── OPENING IS NOT MASTERING ─────────────────────────────────────────────────
 * Selecting an item calls `open`, which moves NOT_STARTED → IN_PROGRESS and
 * never further. DEMONSTRATED is set only by a validated assessment on the
 * server; `stateAfterOpen` is the one place the client predicts a state, and it
 * can never predict that one.
 * =============================================================================
 */

import type {
  ApprenticeshipSummary,
  CompetencyState,
  EnrollResult,
  Enrollment,
  EnrollmentStatus,
  KsbCounts,
  KsbType,
  ProgressSummary,
  TutorSession,
} from './learning.types';

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const COMPETENCY_STATE_LABELS: Record<CompetencyState, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  DEMONSTRATED: 'Demonstrated',
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
};

export const KSB_TYPE_LABELS: Record<KsbType, string> = {
  KNOWLEDGE: 'Knowledge',
  SKILL: 'Skills',
  BEHAVIOUR: 'Behaviours',
  DUTY: 'Duties',
};

/** Order the type groups render in. */
export const KSB_TYPE_ORDER: readonly KsbType[] = [
  'KNOWLEDGE',
  'SKILL',
  'BEHAVIOUR',
  'DUTY',
];

export const levelLabel = (level: number): string => `Level ${level}`;

/** The four confidence steps' meanings, 1–5. */
export const CONFIDENCE_LABELS: Record<number, string> = {
  1: 'Not confident',
  2: 'A little confident',
  3: 'Fairly confident',
  4: 'Confident',
  5: 'Very confident',
};

/* -------------------------------------------------------------------------- */
/* Marketplace                                                                */
/* -------------------------------------------------------------------------- */

export type EnrolCta = 'enrol' | 'resume' | 'unavailable';

/**
 * What a course's primary button does for this learner.
 *
 * An existing enrolment that has not been withdrawn is resumed — the server
 * keeps one active enrolment per learner per course, so offering Enrol would
 * only answer `created: false`. A withdrawn one can be enrolled in afresh. A
 * course that is not AVAILABLE can be neither started nor re-started, but an
 * enrolment already in it is still the learner's to resume.
 */
export const enrolCta = (
  course: Pick<ApprenticeshipSummary, 'availability' | 'enrollment'>,
): EnrolCta => {
  if (course.enrollment && course.enrollment.status !== 'WITHDRAWN') {
    return 'resume';
  }
  return course.availability === 'AVAILABLE' ? 'enrol' : 'unavailable';
};

export const ENROL_CTA_LABELS: Record<EnrolCta, string> = {
  enrol: 'Enrol',
  resume: 'Resume',
  unavailable: 'Unavailable',
};

/** The enrolment-state tag a card shows, or null when not enrolled. */
export const enrolmentTag = (
  course: Pick<ApprenticeshipSummary, 'enrollment'>,
): string | null =>
  course.enrollment
    ? `Enrolled · ${ENROLLMENT_STATUS_LABELS[course.enrollment.status]}`
    : null;

export interface EnrolOutcome {
  enrollmentId: string;
  message: string;
  /** False when an active enrolment already existed and was returned as-is. */
  isNew: boolean;
}

/** What to say and where to go after `POST /learning/enrollments`. */
export const enrolOutcome = (result: EnrolResultLike): EnrolOutcome => ({
  enrollmentId: result.enrollment.id,
  isNew: result.created,
  message: result.created
    ? `You're enrolled in ${result.enrollment.apprenticeship.title}.`
    : "You're already enrolled — resuming.",
});

type EnrolResultLike = Pick<EnrollResult, 'created'> & {
  enrollment: Pick<Enrollment, 'id'> & {
    apprenticeship: Pick<Enrollment['apprenticeship'], 'title'>;
  };
};

/** The KSB/D type tabs to offer — a type the course has none of gets no tab. */
export const ksbTypeTabs = (
  counts: Pick<KsbCounts, 'knowledge' | 'skills' | 'behaviours' | 'duties'>,
): Array<{ type: KsbType; label: string; count: number }> => {
  const byType: Record<KsbType, number> = {
    KNOWLEDGE: counts.knowledge,
    SKILL: counts.skills,
    BEHAVIOUR: counts.behaviours,
    DUTY: counts.duties,
  };
  return KSB_TYPE_ORDER.filter((type) => byType[type] > 0).map((type) => ({
    type,
    label: KSB_TYPE_LABELS[type],
    count: byType[type],
  }));
};

/**
 * Whether a list section has anything to show. A course whose standard
 * publishes no duties has empty `learningOutcomes`, and renders no section for
 * them — not an empty heading.
 */
export const hasItems = (
  list: readonly unknown[] | null | undefined,
): boolean => Array.isArray(list) && list.length > 0;

/* -------------------------------------------------------------------------- */
/* Enrolments and progress                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 0–100, rounded, clamped. The server's `percentDemonstrated` is used when it is
 * a sane number; otherwise it is recomputed from the counts. Never a grade.
 */
export const progressPercent = (
  progress: Pick<ProgressSummary, 'total' | 'demonstrated'> &
    Partial<Pick<ProgressSummary, 'percentDemonstrated'>>,
): number => {
  const fromServer = progress.percentDemonstrated;
  if (typeof fromServer === 'number' && Number.isFinite(fromServer)) {
    return Math.min(100, Math.max(0, Math.round(fromServer)));
  }
  if (!progress.total || progress.total <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((progress.demonstrated / progress.total) * 100)),
  );
};

export type EnrollmentStatusFilter = EnrollmentStatus | 'ALL';

/** Enrolments matching a status filter; `ALL` keeps every one, in order. */
export const filterEnrollmentsByStatus = <T extends Pick<Enrollment, 'status'>>(
  list: readonly T[],
  status: EnrollmentStatusFilter,
): T[] =>
  status === 'ALL' ? [...list] : list.filter((item) => item.status === status);

/* -------------------------------------------------------------------------- */
/* Competencies                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The state the client may show after `open`, before the server answers.
 * NOT_STARTED → IN_PROGRESS; anything else is unchanged. Never DEMONSTRATED.
 */
export const stateAfterOpen = (state: CompetencyState): CompetencyState =>
  state === 'NOT_STARTED' ? 'IN_PROGRESS' : state;

/** Above this many rows the KSB navigator virtualises instead of paging. */
export const VIRTUALISE_THRESHOLD = 50;

export const shouldVirtualise = (count: number): boolean =>
  count > VIRTUALISE_THRESHOLD;

/** A valid self-confidence value, or null. */
export const clampConfidence = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
};

/* -------------------------------------------------------------------------- */
/* Errors and the tutor                                                       */
/* -------------------------------------------------------------------------- */

/** `details.code` (or the top-level `code`) off an RTK Query rejection. */
export const learningErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  /* Mobile: ApiQueryError carries `code` and `details` on the error itself. */
  const own = error as { code?: unknown; details?: { code?: unknown } | null };
  if (typeof own.code === 'string') return own.code;
  if (own.details && typeof own.details === 'object' && typeof own.details.code === 'string') return own.details.code;
  /* Web: the code sits under `data`. */
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const d = data as { code?: unknown; details?: { code?: unknown } | null };
  if (typeof d.code === 'string') return d.code;
  if (d.details && typeof d.details.code === 'string') return d.details.code;
  return null;
};

const statusOf = (error: unknown): unknown =>
  error && typeof error === 'object'
    ? (error as { status?: unknown }).status
    : undefined;

export const isTutorUnavailable = (error: unknown): boolean =>
  statusOf(error) === 503 && learningErrorCode(error) === 'TUTOR_UNAVAILABLE';

export const isProfileIncomplete = (error: unknown): boolean =>
  statusOf(error) === 403 && learningErrorCode(error) === 'PROFILE_INCOMPLETE';

/** Poll the transcript only while a turn is actually streaming. */
export const shouldPollTutor = (
  session: Pick<TutorSession, 'activeTurn'> | null | undefined,
): boolean => session?.activeTurn?.status === 'STREAMING';

export const TUTOR_POLL_INTERVAL_MS = 2000;

export type TutorPanelState = 'idle' | 'streaming' | 'unavailable' | 'error';

/**
 * Which state the tutor panel is in. Unavailable outranks everything: the
 * learner's message was stored and NO reply exists, so the panel says so
 * rather than showing a spinner or anything that could pass for an answer.
 */
export const tutorPanelState = ({
  session,
  sendError,
}: {
  session: Pick<TutorSession, 'activeTurn'> | null | undefined;
  sendError: unknown;
}): TutorPanelState => {
  if (sendError && isTutorUnavailable(sendError)) return 'unavailable';
  if (shouldPollTutor(session)) return 'streaming';
  if (sendError) return 'error';
  return 'idle';
};

export const LEARNING_DISCLAIMER =
  'AI learning progress is not an officially awarded apprenticeship qualification or end-point assessment result.';
