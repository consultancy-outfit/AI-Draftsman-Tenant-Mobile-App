/**
 * =============================================================================
 * AI LEARNING — wire types (AI Feed, Shorts, AI Courses, quizzes, progress)
 * =============================================================================
 * A COPY of `libs/b2b-shared/src/learning/ai-contracts.ts` in the `ai-draftsman`
 * backend (see `docs/ai-learning-flow.md` there). Kept field-for-field: the
 * response is cast to these, so a rename here without the backend would read
 * `undefined` silently. Change the backend contract first, then this file.
 *
 * Official vs generated: `AiUpdateDetail.source` is the provider's own page;
 * every field under `explanation` is AI-written and the UI labels it as such.
 * =============================================================================
 */

export const AI_UPDATE_CATEGORIES = [
  'MODEL_RELEASE',
  'FEATURE',
  'API_CHANGE',
  'PRICING',
  'DEPRECATION',
  'SDK',
  'DOCUMENTATION',
  'PLATFORM',
  'SECURITY',
  'ANNOUNCEMENT',
  'OTHER',
] as const;
export type AiUpdateCategory = (typeof AI_UPDATE_CATEGORIES)[number];

export const AI_CONTENT_TYPES = [
  'NEWS',
  'SHORT',
  'COURSE',
  'LESSON',
  'ASSESSMENT',
] as const;
export type AiContentType = (typeof AI_CONTENT_TYPES)[number];

export const AI_LEARNING_ERROR_CODES = {
  /** The metro (third) database is not reachable or not configured. */
  FEED_UNAVAILABLE: 'AI_FEED_UNAVAILABLE',
  /** No attempts left on a quiz with `maxAttempts`. */
  ATTEMPTS_EXHAUSTED: 'AI_QUIZ_ATTEMPTS_EXHAUSTED',
  /** A submitted answer names a question or option the quiz does not have. */
  INVALID_ANSWERS: 'AI_QUIZ_INVALID_ANSWERS',
} as const;

/** Importance at or above this is "important" in the feed. */
export const AI_IMPORTANT_THRESHOLD = 4;

/** Cursor page, as `@b2b/shared/pagination` `buildCursorPage` returns it. */
export interface AiCursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── Providers ───────────────────────────────────────────────────────────────

export interface AiProviderSummary {
  /** metro manufacturers.id — also the slug used in routes and filters. */
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  color: string;
  tier: string | null;
  website: string | null;
  /** PUBLISHED updates in the last 30 days. */
  recentUpdates: number;
}

export interface AiProviderDetail extends AiProviderSummary {
  description: string | null;
  country: string | null;
  /** Current (non-retired) models, newest first, capped. */
  models: Array<{
    id: string;
    name: string;
    releaseDate: string | null;
    status: string | null;
    contextWindow: number | null;
  }>;
  /** PROVIDER-track courses for this provider. */
  courses: AiCourseSummary[];
}

// ─── Feed ────────────────────────────────────────────────────────────────────

export interface AiUpdateListQuery {
  cursor?: string;
  limit?: number;
  /** Provider slug(s), comma-separated. */
  provider?: string;
  category?: AiUpdateCategory | string;
  /** Free text over title + summary. */
  q?: string;
  /** `today` | `7d` | `30d`, or an ISO date. */
  since?: string;
  /** `true` → importance >= AI_IMPORTANT_THRESHOLD only. */
  important?: string | boolean;
  /** `true` → only updates this learner has not opened. */
  unseen?: string | boolean;
}

export interface AiUpdateSummary {
  id: string;
  provider: { id: string; name: string; color: string; logo: string | null };
  title: string;
  /** AI-written one-paragraph summary (labelled in the UI). */
  summary: string | null;
  category: AiUpdateCategory;
  importance: number;
  tags: string[];
  publishedAt: string;
  sourceUrl: string | null;
  /** official | independent_board | vendor_claim */
  provenance: string;
  hasShort: boolean;
  /** The learner has opened this update before. */
  seen: boolean;
}

export interface AiUpdateDetail extends AiUpdateSummary {
  /** The official source this update is based on. */
  source: { url: string | null; type: string | null; provenance: string };
  /** Everything below is AI-generated from the source. */
  explanation: {
    summary: string | null;
    whyItMatters: string | null;
    whoItAffects: string | null;
    technicalDetails: string | null;
    beginner: string | null;
    developer: string | null;
    generatedBy: string | null;
  };
  shorts: AiShortSummary[];
  related: AiUpdateSummary[];
  relatedLessons: Array<{
    id: string;
    title: string;
    courseSlug: string;
    courseTitle: string;
  }>;
}

// ─── Shorts ──────────────────────────────────────────────────────────────────

export interface AiShortListQuery {
  cursor?: string;
  limit?: number;
  provider?: string;
  unseen?: string | boolean;
}

/**
 * Key style: b2b-core serves the deck camelCase (`durationS`, `totalDurationS`,
 * `correctOptionId`, `audioUrl`) — `AiShortSlide` in the backend's
 * `libs/b2b-shared/src/learning/ai-contracts.ts`. Only ML's stored
 * `short_videos.metadata.deck` is snake_case, and the portal never reads it.
 *
 * A short is either an MP4 (`video`, every short made before 2026-11-17) or a
 * slide deck (`slides`) the portal renders itself as a story: one narrated
 * card per slide. A row without `format` is a video.
 */
export type AiShortFormat = 'video' | 'slides';

/**
 * Deck v1 kinds plus the v2 additions (`compare`, `facts`, `roles`, `tryit`,
 * `poll`). b2b-core drops any kind it does not know, so a portal never sees
 * one outside this set; the player still renders an unknown kind as a plain
 * heading + body card rather than nothing.
 */
export type AiSlideKind =
  | 'headline'
  | 'stat'
  | 'compare'
  | 'facts'
  | 'why'
  | 'who'
  | 'roles'
  | 'tryit'
  | 'quiz'
  | 'poll'
  | 'cta';

/** The recorded change a stat slide shows. Values come from the metro change
 *  log, never from model text; `before` is null for a value set for the first time. */
export interface AiSlideStat {
  label: string;
  before: string | null;
  after: string;
  change: 'up' | 'down' | 'new' | 'changed';
}

/** One row of a `compare` slide: the same shape as a stat. */
export type AiSlideCompareRow = AiSlideStat;

/** One card of a `facts` slide. Values come from the models row, never model text. */
export interface AiSlideFact {
  label: string;
  value: string;
}

/** One chip of a `roles` slide: who should care, and why. */
export interface AiSlideRole {
  role: string;
  why: string;
}

export interface AiSlideOption {
  id: string;
  text: string;
}

export type AiSlideActionType = 'open_update' | 'related_lesson';

export interface AiSlide {
  id: string;
  kind: AiSlideKind;
  heading: string;
  body?: string | null;
  narration: string;
  /** Signed narration clip; null when TTS failed — the slide then shows silently for `durationS`. */
  audioUrl: string | null;
  durationS: number;
  stat?: AiSlideStat | null;
  /** `compare`: 2..6 recorded changes. */
  rows?: AiSlideCompareRow[] | null;
  /** `facts`: 2..6 tap-to-reveal cards. */
  facts?: AiSlideFact[] | null;
  /** `roles`: 2..4 chips. */
  roles?: AiSlideRole[] | null;
  /** `tryit`: an example prompt, and the model's display name (or null). */
  prompt?: string | null;
  model?: string | null;
  /** `quiz` and `poll`. */
  question?: string | null;
  options?: AiSlideOption[] | null;
  /** `quiz` only; a poll has no right answer. */
  correctOptionId?: string | null;
  explanation?: string | null;
  actions?: Array<{ type: AiSlideActionType }> | null;
}

export interface AiShortDeck {
  version: number;
  provider: string | null;
  /** The provider's colour (`manufacturers.color`), or null. */
  accent: string | null;
  totalDurationS: number;
  slides: AiSlide[];
}

export interface AiShortSummary {
  id: string;
  title: string;
  description: string | null;
  provider: { id: string; name: string; color: string } | null;
  updateId: string | null;
  durationS: number | null;
  publishedAt: string | null;
  /** Absent on rows served before slide shorts existed: read it as `video`. */
  format?: AiShortFormat;
  /** Present when `format === 'slides'`. */
  deck?: AiShortDeck | null;
  /** Short-lived SAS URLs (minutes). Null when storage is not configured. */
  videoUrl: string | null;
  thumbnailUrl: string | null;
  captionsUrl: string | null;
  /** Learner state, so the feed can resume and skip watched items. */
  progress: number;
  completed: boolean;
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export type AiCourseTrack = 'FUNDAMENTALS' | 'PROVIDER';
export type AiProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface AiCourseSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  track: AiCourseTrack;
  manufacturerId: string | null;
  level: string | null;
  estMinutes: number | null;
  lessonCount: number;
  completedLessons: number;
  state: AiProgressState;
}

export interface AiLessonSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  estMinutes: number | null;
  completed: boolean;
  progress: number;
}

export interface AiQuizSummary {
  id: string;
  slug: string;
  title: string;
  scope: 'MODULE' | 'COURSE';
  questionCount: number;
  passPct: number;
  maxAttempts: number | null;
  attempts: number;
  bestScorePct: number | null;
  passed: boolean;
}

export interface AiCourseDetail extends AiCourseSummary {
  modules: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    lessons: AiLessonSummary[];
    quiz: AiQuizSummary | null;
  }>;
  finalQuiz: AiQuizSummary | null;
  /** First incomplete lesson — "Resume". Null when every lesson is complete. */
  resumeLessonId: string | null;
}

export interface AiLessonDetail extends AiLessonSummary {
  bodyMd: string;
  course: { id: string; slug: string; title: string };
  module: { id: string; slug: string; title: string };
  lastPosition: string | null;
  previousLessonId: string | null;
  nextLessonId: string | null;
  relatedUpdates: AiUpdateSummary[];
  short: AiShortSummary | null;
  /** The module quiz, offered once the module's lessons are complete. */
  quiz: AiQuizSummary | null;
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export type AiQuestionType = 'SINGLE' | 'MULTI' | 'TRUE_FALSE' | 'SCENARIO';

export interface AiQuizQuestion {
  id: string;
  type: AiQuestionType;
  prompt: string;
  options: Array<{ id: string; text: string }>;
}

export interface AiQuizDetail extends AiQuizSummary {
  courseSlug: string;
  /** Answers are NEVER included before submission. */
  questions: AiQuizQuestion[];
}

export interface AiQuizSubmitInput {
  /** questionId → chosen option ids. */
  answers: Record<string, string[]>;
  startedAt?: string;
}

export interface AiQuizResult {
  attemptId: string;
  attemptNo: number;
  score: number;
  maxScore: number;
  scorePct: number;
  passed: boolean;
  passPct: number;
  attemptsLeft: number | null;
  review: Array<{
    questionId: string;
    prompt: string;
    chosen: string[];
    correct: string[];
    isCorrect: boolean;
    explanation: string | null;
  }>;
  /** The course is now complete (all lessons + every quiz passed). */
  courseCompleted: boolean;
}

export interface AiQuizAttemptSummary {
  id: string;
  attemptNo: number;
  score: number;
  maxScore: number;
  scorePct: number;
  passed: boolean;
  completedAt: string;
}

// ─── Progress & views ────────────────────────────────────────────────────────

export interface AiViewInput {
  contentType: AiContentType;
  contentId: string;
  /** 0..1; never moves backwards. */
  progress?: number;
  /** Seconds into a short, or a lesson anchor. */
  lastPosition?: string;
  completed?: boolean;
}

export interface AiViewResult {
  contentType: AiContentType;
  contentId: string;
  viewCount: number;
  progress: number;
  completed: boolean;
  firstViewedAt: string;
  lastViewedAt: string;
}

export interface AiHistoryItem {
  contentType: AiContentType;
  contentId: string;
  title: string | null;
  lastViewedAt: string;
  progress: number;
  completed: boolean;
}

export interface AiMyProgress {
  inProgress: AiCourseSummary[];
  completed: AiCourseSummary[];
  quizAttempts: Array<
    AiQuizAttemptSummary & {
      quizId: string;
      quizTitle: string;
      courseSlug: string;
    }
  >;
  counts: {
    updatesSeen: number;
    shortsWatched: number;
    lessonsCompleted: number;
    coursesCompleted: number;
    quizzesPassed: number;
  };
}
