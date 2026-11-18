/**
 * =============================================================================
 * LEARNING — the wire contract, copied from the backend
 * =============================================================================
 * A verbatim copy of `libs/b2b-shared/src/learning/contracts.ts` in the
 * `ai-draftsman` workspace. This app cannot import that library, so the shapes
 * are mirrored here; when one changes there it changes here, in the same PR
 * pair. Nothing is added that the gateway does not send.
 *
 * ── SELF-REPORTED VS ASSESSED ────────────────────────────────────────────────
 * `selfConfidence` (what the learner says) and `state` (what an assessment
 * showed) are separate fields on purpose. No path turns the first into the
 * second, and the UI must not present them as one number.
 * =============================================================================
 */

export type KsbType = 'KNOWLEDGE' | 'SKILL' | 'BEHAVIOUR' | 'DUTY';
export type ApprenticeshipAvailability =
  'AVAILABLE' | 'UNPUBLISHED' | 'WITHDRAWN';
export type EnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'WITHDRAWN';
/** NOT_STARTED → IN_PROGRESS (opened / being taught) → DEMONSTRATED (assessed). */
export type CompetencyState = 'NOT_STARTED' | 'IN_PROGRESS' | 'DEMONSTRATED';
export type AssessmentKind =
  'DIAGNOSTIC' | 'QUIZ' | 'SCENARIO' | 'ROLEPLAY' | 'CASE_STUDY';
export type TutorSessionStatus = 'ACTIVE' | 'CLOSED';
export type TutorTurnStatus = 'STREAMING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

/** Error `details.code` values a learner client is expected to branch on. */
export const LEARNING_ERROR_CODES = {
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  APPRENTICESHIP_UNAVAILABLE: 'APPRENTICESHIP_UNAVAILABLE',
  ENROLLMENT_NOT_ACTIVE: 'ENROLLMENT_NOT_ACTIVE',
  TUTOR_UNAVAILABLE: 'TUTOR_UNAVAILABLE',
  TURN_IN_PROGRESS: 'TURN_IN_PROGRESS',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KsbCounts {
  knowledge: number;
  skills: number;
  behaviours: number;
  duties: number;
  /** One specialist agent per active item — the sum of the four above. */
  specialists: number;
}

export interface PublishedVersionRef {
  id: string;
  /** Our own monotonically increasing version number for this course. */
  seq: number;
  /** The standard's version as published by Skills England, e.g. "1.2". */
  standardVersion: string;
  publishedAt: string;
}

export interface ApprenticeshipSummary {
  id: string;
  ref: string;
  slug: string;
  title: string;
  level: number;
  route: string;
  pathway: string | null;
  durationMonths: number | null;
  summary: string;
  availability: ApprenticeshipAvailability;
  publishedVersion: PublishedVersionRef | null;
  counts: KsbCounts;
  /** The caller's own enrolment, if any. Never anyone else's. */
  enrollment: { id: string; status: EnrollmentStatus } | null;
  /** Whether the caller's WORKSPACE has favourited this course — shared by every colleague. */
  isFavourite: boolean;
}

export interface SourceAttribution {
  label: string;
  url: string | null;
}

/** `PUT` / `DELETE /learning/favourites/:apprenticeshipId` — the state after the call. */
export interface FavouriteResult {
  apprenticeshipId: string;
  isFavourite: boolean;
}

export interface ApprenticeshipDetail extends ApprenticeshipSummary {
  overview: string;
  standardUrl: string | null;
  /** Human-readable guidance on where authoritative answers come from. */
  officialSources: string | null;
  /** Shown as a banner for safety-critical occupations. */
  safetyNotice: string | null;
  /** How the AI tutor pitches teaching for this course's level. */
  teachingApproach: string | null;
  /** The standard publishes duties; where it does not, this is empty. */
  learningOutcomes: string[];
  /** Not supplied by the current source; kept so the UI has a slot for it. */
  prerequisites: string[];
  orchestrator: {
    description: string;
    specialistCounts: KsbCounts;
  };
  sources: SourceAttribution[];
  licence: string;
  /** Last time a daily knowledge refresh finished successfully (any outcome but FAILED). */
  lastSuccessfulRefreshAt: string | null;
  /** Last time the source standard was checked. */
  lastCheckedAt: string | null;
}

export interface AiImpactSummary {
  level: string | null;
  effect: string | null;
  whatChanges: string | null;
  humanRole: string | null;
  risks: string | null;
}

export interface KsbItem {
  code: string;
  type: KsbType;
  /** Verbatim from the published standard. */
  statement: string;
  status: 'ACTIVE' | 'RETIRED';
  aiOnTheJob: AiImpactSummary | null;
  aiInTraining: {
    level: string | null;
    howAiHelpsLearning: string | null;
    mustLearnWithoutAi: string | null;
  } | null;
}

export interface ChangelogEntry {
  versionSeq: number;
  standardVersion: string;
  publishedAt: string;
  summary: string;
  changes: Array<{
    code: string | null;
    kind: 'NEW' | 'RETIRED' | 'STATEMENT_CHANGED' | 'METADATA';
    note: string;
  }>;
}

export interface EnrollmentPreferences {
  subjectFamiliarity: 'NEW' | 'SOME' | 'CONFIDENT' | null;
  courseGoals: string | null;
  weeklyHours: number | null;
  learningPreferences: string[];
}

export const LEARNING_PREFERENCE_OPTIONS = [
  { value: 'WORKED_EXAMPLES', label: 'Worked examples' },
  { value: 'STEP_BY_STEP', label: 'Step-by-step procedures' },
  { value: 'QUIZZES', label: 'Quick quizzes' },
  { value: 'SCENARIOS', label: 'Workplace scenarios' },
  { value: 'VISUALS', label: 'Diagrams and visuals' },
  { value: 'SHORT_SESSIONS', label: 'Short sessions' },
] as const;

export const WEEKLY_HOURS_MIN = 1;
export const WEEKLY_HOURS_MAX = 40;
export const COURSE_GOALS_MAX_LENGTH = 500;

export interface ProgressSummary {
  total: number;
  notStarted: number;
  inProgress: number;
  demonstrated: number;
  /** demonstrated / total, 0–100, rounded. Not a qualification grade. */
  percentDemonstrated: number;
}

export interface NextActivity {
  code: string;
  type: KsbType;
  statement: string;
  kind: 'DIAGNOSTIC' | 'LESSON' | 'PRACTICE' | 'ASSESSMENT';
  reason: string;
}

export interface Enrollment {
  id: string;
  apprenticeshipId: string;
  apprenticeship: { ref: string; title: string; level: number; slug: string };
  pinnedVersion: PublishedVersionRef;
  /** Set when a newer published version exists than the one this enrolment is pinned to. */
  newerVersionAvailable: PublishedVersionRef | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  lastActivityAt: string | null;
  progress: ProgressSummary;
  currentCode: string | null;
  nextActivity: NextActivity | null;
  preferences: EnrollmentPreferences;
  latestSessionId: string | null;
}

export interface EnrollResult {
  enrollment: Enrollment;
  /** false = an active enrolment already existed and is returned unchanged. */
  created: boolean;
}

export interface PlanItem {
  code: string;
  type: KsbType;
  statement: string;
  state: CompetencyState;
  priority: 'HIGH' | 'NORMAL';
}

export interface LearningPlan {
  enrollmentId: string;
  generatedAt: string;
  basis: 'INITIAL' | 'DIAGNOSTIC' | 'PROGRESS';
  groups: Array<{ title: string; dutyCode: string | null; items: PlanItem[] }>;
}

export interface Competency {
  code: string;
  type: KsbType;
  statement: string;
  state: CompetencyState;
  /** Learner's own 1–5 rating. Never changes `state`. */
  selfConfidence: number | null;
  lastAssessedAt: string | null;
  /** Which published version the assessment was made against. */
  assessedAgainstVersionSeq: number | null;
  attempts: number;
  /** Item retired by a later version this enrolment migrated to; history is kept. */
  retired: boolean;
}

export interface AssessmentAttempt {
  id: string;
  code: string;
  kind: AssessmentKind;
  score: number;
  maxScore: number;
  passed: boolean;
  feedback: string;
  createdAt: string;
  sessionId: string | null;
}

export interface LearningEvidence {
  id: string;
  code: string;
  title: string;
  description: string;
  link: string | null;
  submittedAt: string;
  /** Learner-submitted. Not reviewed or verified by an assessor. */
  status: 'SUBMITTED';
}

export interface TutorSession {
  id: string;
  enrollmentId: string;
  focusCodes: string[];
  status: TutorSessionStatus;
  contentVersionSeq: number;
  startedAt: string;
  lastMessageAt: string | null;
  activeTurn: { turnId: string; status: TutorTurnStatus } | null;
}

export interface TutorMessage {
  id: string;
  role: 'learner' | 'tutor';
  content: string;
  createdAt: string;
  status: 'COMPLETE' | 'STREAMING' | 'FAILED' | 'CANCELLED';
  /** KSB codes whose specialist contributed. Empty for learner messages. */
  agentCodes: string[];
}

export interface SendTutorMessageResult {
  turnId: string;
  learnerMessage: TutorMessage;
  status: TutorTurnStatus;
}
