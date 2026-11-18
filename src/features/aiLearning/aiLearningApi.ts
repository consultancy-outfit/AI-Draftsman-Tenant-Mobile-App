/**
 * =============================================================================
 * AI LEARNING API — AI Feed, Shorts, AI Courses, quizzes and the learner's own
 * progress (AIDRAFTSMA-209)
 * =============================================================================
 * Every staff route in `docs/ai-learning-flow.md` (ai-draftsman), under
 * `/learning/ai/*` on the usual `/api/v1` base. Live only: the first path
 * segment is `learning`, which `hybridBaseQuery` routes as a whole live subtree
 * — nothing here is mocked. A mocked feed would show plausible provider news
 * that never happened.
 *
 * Wire types are a copy of the backend contract: `./aiLearning.types.ts`.
 * Ported from the web/desktop `store/api/aiLearning.api.ts`; mobile uses the shared
 * `api` slice (cookie session) and its `query` option instead of a hand-built string.
 *
 * ── THE LEARNER IS THE SESSION ───────────────────────────────────────────────
 * No route takes a user, customer or tenant id. `seen`, `progress`,
 * `completed` and attempt counts are the caller's own.
 *
 * ── CURSOR LISTS ─────────────────────────────────────────────────────────────
 * `getAiUpdates` and `getAiShorts` are infinite lists in the `messages.api`
 * pattern: one cache entry per FILTER set (the cursor is left out of the key),
 * the first page replaces and every later page appends, de-duplicated by id.
 * Changing a filter is a different entry, so a stale page from another filter
 * can never be appended to this one.
 *
 * ── VIEWS ARE FIRE-AND-FORGET ────────────────────────────────────────────────
 * `recordAiView` invalidates only My AI learning. It deliberately leaves the
 * feed lists alone: refetching the shorts list after the 50% mark would reset
 * the list the learner is scrolling. Opening an update DOES flip its `seen`
 * dot in every cached feed page — by patch, not refetch, for the same reason.
 *
 * ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
 * A quiz submit carries an `Idempotency-Key` the CALLER supplies (one per
 * attempt, kept across retries of that attempt), exactly as enrol does: a retry
 * after a network failure returns the first result instead of burning a
 * second attempt.
 * =============================================================================
 */

import { api } from '@/store/api';

import type {
  AiContentType,
  AiCourseDetail,
  AiCourseSummary,
  AiCourseTrack,
  AiCursorPage,
  AiHistoryItem,
  AiLessonDetail,
  AiMyProgress,
  AiProviderDetail,
  AiProviderSummary,
  AiQuizAttemptSummary,
  AiQuizDetail,
  AiQuizResult,
  AiQuizSubmitInput,
  AiShortSummary,
  AiUpdateDetail,
  AiUpdateSummary,
  AiViewInput,
  AiViewResult,
} from './aiLearning.types';

const LIST_ID = 'LIST';

/* -------------------------------------------------------------------------- */
/* Request shapes                                                             */
/* -------------------------------------------------------------------------- */

/** The feed's filters. Everything but `cursor` is part of the cache key. */
export interface AiUpdateListParams {
  cursor?: string;
  limit?: number;
  /** Provider slug(s), comma-separated. */
  provider?: string;
  category?: string;
  q?: string;
  since?: string;
  important?: boolean;
  unseen?: boolean;
}

export interface AiShortListParams {
  cursor?: string;
  limit?: number;
  provider?: string;
  unseen?: boolean;
}

export interface AiCourseListParams {
  track?: AiCourseTrack;
  provider?: string;
}

export interface AiHistoryParams {
  limit?: number;
  contentType?: AiContentType;
}

export interface SubmitAiQuizRequest extends AiQuizSubmitInput {
  quizId: string;
  /** Stable per attempt — a retry of the same attempt reuses it. */
  idempotencyKey: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const BASE = '/learning/ai';
const enc = encodeURIComponent;

/** The defined, non-empty values only; `false` is omitted (httpClient would send it as "false"). */
const compact = (
  params: Record<string, string | number | boolean | undefined | null>,
): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    out[key] = value;
  }
  return out;
};

/** A cursor list's cache key: the endpoint and its filters, never the cursor. */
const filterKey = (
  endpointName: string,
  {
    cursor: _cursor,
    ...filters
  }: { cursor?: string } & Record<string, unknown>,
): string =>
  `${endpointName}(${JSON.stringify(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== '' && v !== false)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  )})`;

/** First page replaces; a cursor page appends what is not already there. */
const mergeCursorPage = <T extends { id: string }>(
  existing: AiCursorPage<T>,
  incoming: AiCursorPage<T>,
  cursor: string | undefined,
): void => {
  if (!cursor) {
    existing.items = incoming.items;
  } else {
    const seen = new Set(existing.items.map((item) => item.id));
    existing.items.push(...incoming.items.filter((item) => !seen.has(item.id)));
  }
  existing.nextCursor = incoming.nextCursor;
  existing.hasMore = incoming.hasMore;
};

const attemptsTagId = (quizId: string) => `ATTEMPTS:${quizId}`;

/** What finishing a lesson or a quiz moves: course state, lessons, My AI learning. */
const PROGRESS_TAGS = [
  { type: 'AiCourse', id: LIST_ID },
  { type: 'AiLesson', id: LIST_ID },
  { type: 'AiProgress', id: LIST_ID },
] as const;

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

export const aiLearningApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /* ── Providers (reference data) ───────────────────────────────────── */

    getAiProviders: builder.query<AiProviderSummary[], void>({
      query: () => ({ url: `${BASE}/providers` }),
      providesTags: [{ type: 'AiProvider' as const, id: LIST_ID }],
    }),

    getAiProvider: builder.query<AiProviderDetail, string>({
      query: (slug) => ({ url: `${BASE}/providers/${enc(slug)}` }),
      providesTags: (_r, _e, slug) => [{ type: 'AiProvider' as const, id: slug }],
    }),

    /* ── Feed ──────────────────────────────────────────────────────────── */

    getAiUpdates: builder.query<
      AiCursorPage<AiUpdateSummary>,
      AiUpdateListParams
    >({
      query: ({
        cursor,
        limit,
        provider,
        category,
        q,
        since,
        important,
        unseen,
      }) => ({
        url: `${BASE}/updates`,
        query: compact({ cursor, limit, provider, category, q, since, important, unseen }),
      }),
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        filterKey(endpointName, { ...queryArgs }),
      merge: (existing, incoming, { arg }) =>
        mergeCursorPage(existing, incoming, arg.cursor),
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.cursor !== previousArg?.cursor,
      providesTags: [{ type: 'AiUpdate', id: LIST_ID }],
    }),

    /** Opening an update records a NEWS view on the server — see the header. */
    getAiUpdate: builder.query<AiUpdateDetail, string>({
      query: (id) => ({ url: `${BASE}/updates/${enc(id)}` }),
      providesTags: (_r, _e, id) => [{ type: 'AiUpdate', id }],
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          return;
        }
        for (const args of aiLearningApi.util.selectCachedArgsForQuery(
          getState(),
          'getAiUpdates',
        )) {
          dispatch(
            aiLearningApi.util.updateQueryData(
              'getAiUpdates',
              args,
              (draft) => {
                for (const item of draft.items) {
                  if (item.id === id) item.seen = true;
                }
              },
            ),
          );
        }
      },
    }),

    /* ── Shorts ────────────────────────────────────────────────────────── */

    getAiShorts: builder.query<AiCursorPage<AiShortSummary>, AiShortListParams>(
      {
        query: ({ cursor, limit, provider, unseen }) => ({
          url: `${BASE}/shorts`,
        query: compact({ cursor, limit, provider, unseen }),
        }),
        serializeQueryArgs: ({ endpointName, queryArgs }) =>
          filterKey(endpointName, { ...queryArgs }),
        merge: (existing, incoming, { arg }) =>
          mergeCursorPage(existing, incoming, arg.cursor),
        forceRefetch: ({ currentArg, previousArg }) =>
          currentArg?.cursor !== previousArg?.cursor,
        providesTags: [{ type: 'AiShort', id: LIST_ID }],
      },
    ),

    getAiShort: builder.query<AiShortSummary, string>({
      query: (id) => ({ url: `${BASE}/shorts/${enc(id)}` }),
      providesTags: (_r, _e, id) => [{ type: 'AiShort', id }],
    }),

    /* ── Courses and lessons ───────────────────────────────────────────── */

    getAiCourses: builder.query<AiCourseSummary[], AiCourseListParams | void>({
      query: (params) => ({
        url: `${BASE}/courses`,
        query: compact({ track: params?.track, provider: params?.provider }),
      }),
      providesTags: [{ type: 'AiCourse', id: LIST_ID }],
    }),

    /** Also tagged LIST: its lesson ticks and quiz state move with any progress. */
    getAiCourse: builder.query<AiCourseDetail, string>({
      query: (slug) => ({ url: `${BASE}/courses/${enc(slug)}` }),
      providesTags: (_r, _e, slug) => [
        { type: 'AiCourse', id: slug },
        { type: 'AiCourse', id: LIST_ID },
      ],
    }),

    /** Opening a lesson records a LESSON view on the server. */
    getAiLesson: builder.query<AiLessonDetail, string>({
      query: (id) => ({ url: `${BASE}/lessons/${enc(id)}` }),
      providesTags: (_r, _e, id) => [
        { type: 'AiLesson', id },
        { type: 'AiLesson', id: LIST_ID },
      ],
    }),

    completeAiLesson: builder.mutation<AiViewResult, string>({
      query: (id) => ({
        url: `${BASE}/lessons/${enc(id)}/complete`,
        method: 'POST',
      }),
      invalidatesTags: (_r, error) => (error ? [] : [...PROGRESS_TAGS]),
    }),

    /* ── Quizzes ───────────────────────────────────────────────────────── */

    /** Never carries answers — those arrive only in the submit result. */
    getAiQuiz: builder.query<AiQuizDetail, string>({
      query: (id) => ({ url: `${BASE}/quizzes/${enc(id)}` }),
      providesTags: (_r, _e, id) => [{ type: 'AiQuiz', id }],
    }),

    getAiQuizAttempts: builder.query<AiQuizAttemptSummary[], string>({
      query: (id) => ({ url: `${BASE}/quizzes/${enc(id)}/attempts` }),
      providesTags: (_r, _e, id) => [
        { type: 'AiQuiz', id: attemptsTagId(id) },
      ],
    }),

    submitAiQuiz: builder.mutation<AiQuizResult, SubmitAiQuizRequest>({
      query: ({ quizId, answers, startedAt, idempotencyKey }) => ({
        url: `${BASE}/quizzes/${enc(quizId)}/attempts`,
        method: 'POST',
        body: startedAt ? { answers, startedAt } : { answers },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      /*
       * The quiz detail is NOT invalidated here: the quiz screen is showing the
       * result of this very call, and a refetch of the questions underneath it
       * buys nothing. Its attempt count is re-read on the next visit (the
       * attempts list and the course both refetch now).
       */
      invalidatesTags: (_r, error, { quizId }) =>
        error
          ? []
          : [
              { type: 'AiQuiz', id: attemptsTagId(quizId) },
              ...PROGRESS_TAGS,
            ],
    }),

    /* ── Views and the learner's own progress ─────────────────────────── */

    recordAiView: builder.mutation<AiViewResult, AiViewInput>({
      query: (body) => ({ url: `${BASE}/views`, method: 'POST', body }),
      invalidatesTags: (_r, error) =>
        error ? [] : [{ type: 'AiProgress', id: LIST_ID }],
    }),

    getAiMyProgress: builder.query<AiMyProgress, void>({
      query: () => ({ url: `${BASE}/me/progress` }),
      providesTags: [{ type: 'AiProgress', id: LIST_ID }],
    }),

    getAiMyHistory: builder.query<AiHistoryItem[], AiHistoryParams | void>({
      query: (params) => ({
        url: `${BASE}/me/history`,
        query: compact({ limit: params?.limit, contentType: params?.contentType }),
      }),
      providesTags: [{ type: 'AiProgress', id: LIST_ID }],
    }),
  }),
});

export const {
  useGetAiProvidersQuery,
  useGetAiProviderQuery,
  useGetAiUpdatesQuery,
  useGetAiUpdateQuery,
  useLazyGetAiUpdateQuery,
  useGetAiShortsQuery,
  useGetAiShortQuery,
  useGetAiCoursesQuery,
  useGetAiCourseQuery,
  useGetAiLessonQuery,
  useCompleteAiLessonMutation,
  useGetAiQuizQuery,
  useGetAiQuizAttemptsQuery,
  useSubmitAiQuizMutation,
  useRecordAiViewMutation,
  useGetAiMyProgressQuery,
  useGetAiMyHistoryQuery,
} = aiLearningApi;
