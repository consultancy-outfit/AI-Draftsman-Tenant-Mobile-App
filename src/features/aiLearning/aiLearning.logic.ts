/**
 * =============================================================================
 * AI LEARNING — the pure rules behind the AI Feed, Shorts, AI Courses and
 * quiz screens
 * =============================================================================
 * How the feed groups by day and words a timestamp, when a short reports
 * progress, which answers a question holds, what a quiz result says and how
 * far through a course the learner is. No React, no store, no network —
 * `tools/checks/ai-learning-logic.spec.ts` imports this file by relative path
 * under `node --experimental-strip-types`, so every import here is type-only.
 *
 * ── A SHORT REPORTS THREE TIMES, NOT EVERY TICK ──────────────────────────────
 * The backend's rule (docs/ai-learning-flow.md, "Tracking rules"): the portal
 * posts a view at start, at 50% and at the end, and never on every
 * `timeupdate`. `createViewMilestoneTracker` is the one place that decision
 * is made, and it de-duplicates per short for the life of the tracker (one
 * page visit), so scrolling back to a short does not post its start again.
 *
 * ── OFFICIAL VS GENERATED ────────────────────────────────────────────────────
 * An update's `source` is the provider's page; its `explanation` is AI-written.
 * The labels for both live here so a call site cannot soften either.
 * =============================================================================
 */

import type {
  AiCourseSummary,
  AiProgressState,
  AiQuestionType,
  AiQuizQuestion,
  AiQuizResult,
  AiQuizSubmitInput,
  AiUpdateCategory,
  AiViewInput,
} from './aiLearning.types';

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const AI_CATEGORY_LABELS: Record<AiUpdateCategory, string> = {
  MODEL_RELEASE: 'Model release',
  FEATURE: 'Feature',
  API_CHANGE: 'API change',
  PRICING: 'Pricing',
  DEPRECATION: 'Deprecation',
  SDK: 'SDK',
  DOCUMENTATION: 'Documentation',
  PLATFORM: 'Platform',
  SECURITY: 'Security',
  ANNOUNCEMENT: 'Announcement',
  OTHER: 'Other',
};

/** A category the client does not know yet still gets a readable label. */
export const categoryLabel = (category: string): string =>
  (AI_CATEGORY_LABELS as Record<string, string>)[category] ??
  category
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

export const AI_PROGRESS_STATE_LABELS: Record<AiProgressState, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export const OFFICIAL_SOURCE_LABEL = 'Official source';
export const AI_GENERATED_LABEL = 'AI-generated explanation';
export const AI_GENERATED_NOTE =
  'Written by AI from the official source. Check the source before relying on it.';

/** Mirrors the backend's AI_IMPORTANT_THRESHOLD; a value, not imported, see the header. */
export const IMPORTANT_THRESHOLD = 4;
export const isImportant = (importance: number): boolean =>
  importance >= IMPORTANT_THRESHOLD;

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const startOfLocalDay = (time: number): number => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole local calendar days between `then` and `now` (0 = same day). */
const calendarDaysAgo = (then: number, now: number): number =>
  Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / DAY);

/** "12 Nov", or "12 Nov 2025" when it is not this year. */
export const formatShortDate = (iso: string, now: number = Date.now()) => {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/**
 * "just now", "5m ago", "3h ago", "Yesterday", "4d ago", then a date. A
 * future timestamp (clock skew) reads as "just now" rather than a negative.
 */
export const relativeTime = (
  iso: string | null | undefined,
  now: number = Date.now(),
): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  const days = calendarDaysAgo(then, now);
  if (days === 0) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso, now);
};

/** The heading a day's group carries: Today, Yesterday, or a date. */
export const dayLabel = (iso: string, now: number = Date.now()): string => {
  const days = calendarDaysAgo(new Date(iso).getTime(), now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(new Date(iso).getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: 'numeric' }),
  });
};

export interface DayGroup<T> {
  /** Local calendar day, `YYYY-MM-DD`. Stable as a React key. */
  key: string;
  label: string;
  items: T[];
}

const localDayKey = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Items grouped by local calendar day, in the order they arrived. The feed is
 * newest-first, so the groups are too — and an item that arrives out of order
 * joins its existing day rather than starting a duplicate heading.
 */
export const groupByDay = <T>(
  items: readonly T[],
  dateOf: (item: T) => string,
  now: number = Date.now(),
): Array<DayGroup<T>> => {
  const groups: Array<DayGroup<T>> = [];
  const byKey = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const iso = dateOf(item);
    const key = localDayKey(iso);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dayLabel(iso, now), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
};

/** `1:05` for 65 s; empty when the duration is unknown. */
export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/* -------------------------------------------------------------------------- */
/* Shorts — view milestones and the mounted window                            */
/* -------------------------------------------------------------------------- */

export type ViewMilestone = 'start' | 'half' | 'end';

export const VIEW_MILESTONE_PROGRESS: Record<ViewMilestone, number> = {
  start: 0,
  half: 0.5,
  end: 1,
};

/**
 * The milestones a playback position has reached, lowest first. `ended`
 * counts as the end even when the last `timeupdate` stopped short of 100%.
 */
export const reachedMilestones = (
  fraction: number,
  ended = false,
): ViewMilestone[] => {
  const reached: ViewMilestone[] = ['start'];
  if (ended || fraction >= 0.5) reached.push('half');
  if (ended || fraction >= 0.98) reached.push('end');
  return reached;
};

export interface ViewMilestoneTracker {
  /**
   * Milestones newly reached for this short and not yet reported. Each one is
   * returned exactly once per tracker; the caller posts them.
   */
  take: (shortId: string, fraction: number, ended?: boolean) => ViewMilestone[];
  /** Whether a milestone has already been reported. */
  has: (shortId: string, milestone: ViewMilestone) => boolean;
}

/** One per page visit, held in a ref. See the header. */
export const createViewMilestoneTracker = (): ViewMilestoneTracker => {
  const sent = new Set<string>();
  const key = (shortId: string, m: ViewMilestone) => `${shortId}:${m}`;
  return {
    take(shortId, fraction, ended = false) {
      const fresh = reachedMilestones(fraction, ended).filter(
        (m) => !sent.has(key(shortId, m)),
      );
      for (const m of fresh) sent.add(key(shortId, m));
      return fresh;
    },
    has: (shortId, m) => sent.has(key(shortId, m)),
  };
};

/**
 * The body posted for one milestone. Only the HIGHEST of a batch needs
 * posting — progress never moves backwards on the server — so callers pass
 * the last element of `take`'s result.
 */
export const shortViewInput = (
  shortId: string,
  milestone: ViewMilestone,
  positionS?: number,
): AiViewInput => ({
  contentType: 'SHORT',
  contentId: shortId,
  progress: VIEW_MILESTONE_PROGRESS[milestone],
  ...(positionS != null && Number.isFinite(positionS)
    ? { lastPosition: String(Math.round(positionS)) }
    : {}),
  ...(milestone === 'end' ? { completed: true } : {}),
});

/**
 * How far through a video playback is, 0..1. The element's own duration wins;
 * the server's `durationS` covers the moment before metadata has loaded.
 * `ended` is always 1, whatever the last `timeupdate` said.
 */
export const playbackFraction = (
  currentTime: number,
  mediaDuration: number,
  fallbackDuration: number | null | undefined,
  ended = false,
): number => {
  if (ended) return 1;
  const duration =
    Number.isFinite(mediaDuration) && mediaDuration > 0
      ? mediaDuration
      : (fallbackDuration ?? 0);
  if (!(duration > 0) || !Number.isFinite(currentTime)) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
};

/** Only the current and next shorts hold a `<video>`; the rest are posters. */
export const isShortMounted = (index: number, current: number): boolean =>
  index === current || index === current + 1;

/** Load the next page once the learner is this close to the end. */
export const SHORTS_PREFETCH_DISTANCE = 2;

export const shouldLoadMoreShorts = (
  current: number,
  loaded: number,
  hasMore: boolean,
): boolean =>
  hasMore && loaded > 0 && current >= loaded - SHORTS_PREFETCH_DISTANCE;

/** The index after a ↑/↓ key, clamped to the loaded list. */
export const stepIndex = (current: number, delta: number, length: number) =>
  length <= 0 ? 0 : Math.min(length - 1, Math.max(0, current + delta));

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                    */
/* -------------------------------------------------------------------------- */

export type QuizAnswers = Readonly<Record<string, readonly string[]>>;

/** MULTI takes checkboxes; SINGLE, TRUE_FALSE and SCENARIO take one choice. */
export const isMultiSelect = (type: AiQuestionType): boolean =>
  type === 'MULTI';

/**
 * The answers after the learner picks `optionId`. A single-choice question
 * replaces its answer; MULTI toggles the option. Returns a new object and
 * never mutates — it is React state.
 */
export const selectOption = (
  answers: QuizAnswers,
  question: Pick<AiQuizQuestion, 'id' | 'type' | 'options'>,
  optionId: string,
): QuizAnswers => {
  if (!question.options.some((o) => o.id === optionId)) return answers;
  const current = answers[question.id] ?? [];
  if (!isMultiSelect(question.type)) {
    return { ...answers, [question.id]: [optionId] };
  }
  const next = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId];
  /* Kept in the question's option order, so the payload is deterministic. */
  const order = question.options.map((o) => o.id);
  next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { ...answers, [question.id]: next };
};

export const isAnswered = (answers: QuizAnswers, questionId: string) =>
  (answers[questionId]?.length ?? 0) > 0;

export const answeredCount = (
  answers: QuizAnswers,
  questions: ReadonlyArray<Pick<AiQuizQuestion, 'id'>>,
): number => questions.filter((q) => isAnswered(answers, q.id)).length;

export const allAnswered = (
  answers: QuizAnswers,
  questions: ReadonlyArray<Pick<AiQuizQuestion, 'id'>>,
): boolean =>
  questions.length > 0 &&
  answeredCount(answers, questions) === questions.length;

/** "Question 3/10" — `index` is zero-based. */
export const questionCounter = (index: number, total: number): string =>
  `Question ${index + 1}/${total}`;

/** Only the quiz's own questions, each with at least one choice. */
export const buildSubmitInput = (
  answers: QuizAnswers,
  questions: ReadonlyArray<Pick<AiQuizQuestion, 'id'>>,
  startedAt?: string,
): AiQuizSubmitInput => ({
  answers: Object.fromEntries(
    questions
      .filter((q) => isAnswered(answers, q.id))
      .map((q) => [q.id, [...(answers[q.id] ?? [])]]),
  ),
  ...(startedAt ? { startedAt } : {}),
});

/** "Score 80% · Passed ✓ · 8/10" */
export const scoreLine = (
  result: Pick<AiQuizResult, 'scorePct' | 'passed' | 'score' | 'maxScore'>,
): string =>
  `Score ${Math.round(result.scorePct)}% · ${result.passed ? 'Passed ✓' : 'Not passed'} · ${result.score}/${result.maxScore}`;

export const incorrectAnswers = (result: Pick<AiQuizResult, 'review'>) =>
  result.review.filter((item) => !item.isCorrect);

/** `null` attempts left means unlimited. */
export const canRetry = (result: Pick<AiQuizResult, 'attemptsLeft'>): boolean =>
  result.attemptsLeft === null || result.attemptsLeft > 0;

export const attemptsLeftLabel = (attemptsLeft: number | null): string => {
  if (attemptsLeft === null) return 'Unlimited attempts';
  if (attemptsLeft <= 0) return 'No attempts left';
  return `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left`;
};

/** Attempts remaining before starting, from the quiz summary. */
export const attemptsRemaining = (quiz: {
  maxAttempts: number | null;
  attempts: number;
}): number | null =>
  quiz.maxAttempts === null
    ? null
    : Math.max(0, quiz.maxAttempts - quiz.attempts);

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type AiLearningErrorKind =
  | 'attempts_exhausted'
  | 'feed_unavailable'
  | 'invalid_answers'
  | 'not_found'
  | 'other';

/** The `code` an `ApiError` carries, top level or under `details`. */
export const aiErrorCode = (error: unknown): string | null => {
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

export const aiErrorKind = (error: unknown): AiLearningErrorKind => {
  switch (aiErrorCode(error)) {
    case 'AI_QUIZ_ATTEMPTS_EXHAUSTED':
      return 'attempts_exhausted';
    case 'AI_FEED_UNAVAILABLE':
      return 'feed_unavailable';
    case 'AI_QUIZ_INVALID_ANSWERS':
      return 'invalid_answers';
    default:
      break;
  }
  const status =
    error && typeof error === 'object'
      ? (error as { status?: unknown }).status
      : undefined;
  return status === 404 ? 'not_found' : 'other';
};

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */

/** Lessons complete as a whole percentage, 0–100. */
export const coursePercent = (
  course: Pick<AiCourseSummary, 'lessonCount' | 'completedLessons' | 'state'>,
): number => {
  if (course.state === 'COMPLETED') return 100;
  if (!course.lessonCount || course.lessonCount <= 0) return 0;
  return Math.min(
    100,
    Math.max(
      0,
      Math.round((course.completedLessons / course.lessonCount) * 100),
    ),
  );
};

export interface ProviderCourseGroup<C> {
  providerId: string;
  providerName: string;
  courses: C[];
}

/**
 * The course catalogue as two tracks: AI Fundamentals, then one group per
 * provider in the providers endpoint's order (unknown providers last, by id).
 */
export const groupCoursesByTrack = <
  C extends Pick<AiCourseSummary, 'track' | 'manufacturerId'>,
>(
  courses: readonly C[],
  providers: ReadonlyArray<{ id: string; name: string }>,
): { fundamentals: C[]; providers: Array<ProviderCourseGroup<C>> } => {
  const fundamentals: C[] = [];
  const byProvider = new Map<string, C[]>();
  for (const course of courses) {
    if (course.track === 'FUNDAMENTALS' || !course.manufacturerId) {
      fundamentals.push(course);
      continue;
    }
    const list = byProvider.get(course.manufacturerId) ?? [];
    list.push(course);
    byProvider.set(course.manufacturerId, list);
  }
  const order = providers.map((p) => p.id);
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const groups = [...byProvider.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([providerId, list]) => ({
      providerId,
      providerName:
        providers.find((p) => p.id === providerId)?.name ?? providerId,
      courses: list,
    }));
  return { fundamentals, providers: groups };
};
