/**
 * Apprenticeship Learning API — RTK Query endpoints on the shared `api` slice, ported from the web/desktop
 * `store/api/learning.api.ts`. Everything is under `/learning/*` and is live-only (nothing mocked); the
 * learner is the session, so no route takes a user or tenant id.
 *
 * ── PAGED LISTS ──────────────────────────────────────────────────────────────
 * The catalogue, an apprenticeship's KSBs and an enrolment's competencies are "Load more" lists here (web
 * has numbered pagers): one cache entry per FILTER set (the page is left out of the key), page 1 replaces
 * and every later page appends, de-duplicated. After a write that changes a row, the screen goes back to
 * page 1 (which replaces), so the list never shows a stale row.
 *
 * ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
 * `enroll` and `sendTutorMessage` carry an `Idempotency-Key` the CALLER supplies and keeps across retries of
 * the same action, so a retry after a flaky connection returns the first result instead of repeating it.
 */
import { api } from '@/store/api';

import type {
  ApprenticeshipDetail,
  ApprenticeshipSummary,
  AssessmentAttempt,
  ChangelogEntry,
  Competency,
  CompetencyState,
  Enrollment,
  EnrollmentPreferences,
  EnrollmentStatus,
  EnrollResult,
  FavouriteResult,
  KsbItem,
  KsbType,
  LearningEvidence,
  LearningPlan,
  Paginated,
  SendTutorMessageResult,
  TutorMessage,
  TutorSession,
} from './learning.types';

/* -------------------------------------------------------------------------- */
/* Request shapes                                                             */
/* -------------------------------------------------------------------------- */

export interface ApprenticeshipListParams {
  page?: number;
  limit?: number;
  search?: string;
  level?: number;
  route?: string;
  enrollment?: 'enrolled' | 'not_enrolled';
  favourite?: 'true';
}

export interface KsbListParams {
  apprenticeshipId: string;
  type?: KsbType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EnrollRequest {
  apprenticeshipId: string;
  preferences?: Partial<EnrollmentPreferences>;
  /** Stable per course — a retry of the same enrol reuses it. */
  idempotencyKey: string;
}

export interface UpdateEnrollmentRequest {
  enrollmentId: string;
  preferences?: Partial<EnrollmentPreferences>;
  status?: Extract<EnrollmentStatus, 'ACTIVE' | 'PAUSED' | 'WITHDRAWN'>;
}

export interface CompetencyListParams {
  enrollmentId: string;
  type?: KsbType;
  search?: string;
  state?: CompetencyState;
  page?: number;
  limit?: number;
}

export interface SubmitEvidenceRequest {
  enrollmentId: string;
  code: string;
  title: string;
  description: string;
  link?: string;
}

export interface SendTutorMessageRequest {
  enrollmentId: string;
  sessionId: string;
  content: string;
  focusCode?: string;
  /** Stable per message — a retry of the same message reuses it. */
  idempotencyKey: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const enc = encodeURIComponent;
const enrollmentPath = (id: string) => `/learning/enrollments/${enc(id)}`;
const sessionPath = (enrollmentId: string, sessionId: string) => `${enrollmentPath(enrollmentId)}/sessions/${enc(sessionId)}`;

/** The defined, non-empty values only (httpClient would send `""` as `?x=`). */
const compact = (params: Record<string, string | number | undefined | null>): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
};

const evidenceTagId = (enrollmentId: string) => `EVIDENCE:${enrollmentId}`;
const assessmentsTagId = (enrollmentId: string) => `ASSESS:${enrollmentId}`;
const messagesTagId = (sessionId: string) => `MSG:${sessionId}`;
const FAVOURITES_ID = 'FAVOURITES';
const LIST_ID = 'LIST';

/** A paged list's cache key: the endpoint and its filters, never the page. */
const filterKey = (endpointName: string, { page: _page, ...filters }: { page?: number } & Record<string, unknown>): string =>
  `${endpointName}(${JSON.stringify(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== '')
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  )})`;

/** Page 1 replaces; a later page appends what is not already there. */
const mergePage = <T>(existing: Paginated<T>, incoming: Paginated<T>, page: number | undefined, idOf: (item: T) => string): void => {
  if (!page || page <= 1) {
    existing.items = incoming.items;
  } else {
    const seen = new Set(existing.items.map(idOf));
    existing.items.push(...incoming.items.filter((item) => !seen.has(idOf(item))));
  }
  existing.total = incoming.total;
  existing.page = incoming.page;
  existing.limit = incoming.limit;
  existing.totalPages = incoming.totalPages;
};

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

export const learningApi = api.injectEndpoints({
  endpoints: (builder) => ({
    /* ── Catalogue (read-only) ─────────────────────────────────────────── */

    getApprenticeships: builder.query<Paginated<ApprenticeshipSummary>, ApprenticeshipListParams>({
      query: ({ page, limit, search, level, route, enrollment, favourite }) => ({
        url: '/learning/apprenticeships',
        query: compact({ page, limit, search, level, route, enrollment, favourite }),
      }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => filterKey(endpointName, { ...queryArgs }),
      merge: (existing, incoming, { arg }) => mergePage(existing, incoming, arg.page, (i) => i.id),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: (result, _e, { favourite }) => [
        { type: 'Apprenticeship' as const, id: LIST_ID },
        ...(favourite ? [{ type: 'Apprenticeship' as const, id: FAVOURITES_ID }] : []),
        ...(result?.items ?? []).map((item) => ({ type: 'Apprenticeship' as const, id: item.id })),
      ],
    }),

    getApprenticeship: builder.query<ApprenticeshipDetail, string>({
      query: (id) => ({ url: `/learning/apprenticeships/${enc(id)}` }),
      providesTags: (_r, _e, id) => [{ type: 'Apprenticeship' as const, id }],
    }),

    /* ── Favourites (the workspace's — shared by colleagues) ───────────── */

    /** Optimistic: the heart flips at once on the detail and in every cached list page, and rolls back on failure. */
    setFavourite: builder.mutation<FavouriteResult, { apprenticeshipId: string; isFavourite: boolean }>({
      query: ({ apprenticeshipId, isFavourite }) => ({
        url: `/learning/favourites/${enc(apprenticeshipId)}`,
        method: isFavourite ? 'PUT' : 'DELETE',
      }),
      async onQueryStarted({ apprenticeshipId, isFavourite }, { dispatch, getState, queryFulfilled }) {
        const patches = [
          dispatch(
            learningApi.util.updateQueryData('getApprenticeship', apprenticeshipId, (draft) => {
              draft.isFavourite = isFavourite;
            }),
          ),
          ...learningApi.util.selectCachedArgsForQuery(getState(), 'getApprenticeships').map((args) =>
            dispatch(
              learningApi.util.updateQueryData('getApprenticeships', args, (draft) => {
                for (const item of draft.items) if (item.id === apprenticeshipId) item.isFavourite = isFavourite;
              }),
            ),
          ),
        ];
        try {
          await queryFulfilled;
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
      /* The favourites-only list refetches; other lists are already right. */
      invalidatesTags: (_r, error) => (error ? [] : [{ type: 'Apprenticeship' as const, id: FAVOURITES_ID }]),
    }),

    getApprenticeshipKsbs: builder.query<Paginated<KsbItem>, KsbListParams>({
      query: ({ apprenticeshipId, type, search, page, limit }) => ({
        url: `/learning/apprenticeships/${enc(apprenticeshipId)}/ksbs`,
        query: compact({ type, search, page, limit }),
      }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => filterKey(endpointName, { ...queryArgs }),
      merge: (existing, incoming, { arg }) => mergePage(existing, incoming, arg.page, (i) => i.code),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: (_r, _e, { apprenticeshipId }) => [{ type: 'Apprenticeship' as const, id: apprenticeshipId }],
    }),

    getApprenticeshipChangelog: builder.query<ChangelogEntry[], string>({
      query: (id) => ({ url: `/learning/apprenticeships/${enc(id)}/changelog` }),
      providesTags: (_r, _e, id) => [{ type: 'Apprenticeship' as const, id }],
    }),

    /* ── Enrolments ────────────────────────────────────────────────────── */

    getEnrollments: builder.query<Enrollment[], void>({
      query: () => ({ url: '/learning/enrollments' }),
      providesTags: (result) => [
        { type: 'Enrollment' as const, id: LIST_ID },
        ...(result ?? []).map((item) => ({ type: 'Enrollment' as const, id: item.id })),
      ],
    }),

    /** `created: false` means an active enrolment already existed — resume it. */
    enroll: builder.mutation<EnrollResult, EnrollRequest>({
      query: ({ apprenticeshipId, preferences, idempotencyKey }) => ({
        url: '/learning/enrollments',
        method: 'POST',
        body: preferences ? { apprenticeshipId, preferences } : { apprenticeshipId },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: (_r, _e, { apprenticeshipId }) => [
        { type: 'Enrollment' as const, id: LIST_ID },
        { type: 'Apprenticeship' as const, id: LIST_ID },
        { type: 'Apprenticeship' as const, id: apprenticeshipId },
      ],
    }),

    getEnrollment: builder.query<Enrollment, string>({
      query: (id) => ({ url: enrollmentPath(id) }),
      providesTags: (_r, _e, id) => [{ type: 'Enrollment' as const, id }],
    }),

    updateEnrollment: builder.mutation<Enrollment, UpdateEnrollmentRequest>({
      query: ({ enrollmentId, preferences, status }) => ({
        url: enrollmentPath(enrollmentId),
        method: 'PATCH',
        /* Built key by key — the server refuses anything extra. */
        body: { ...(preferences ? { preferences } : {}), ...(status ? { status } : {}) },
      }),
      invalidatesTags: (_r, _e, { enrollmentId }) => [
        { type: 'Enrollment' as const, id: enrollmentId },
        { type: 'Enrollment' as const, id: LIST_ID },
        { type: 'Apprenticeship' as const, id: LIST_ID },
      ],
    }),

    /** Irreversible: moves the enrolment to the latest published version. */
    migrateEnrollmentVersion: builder.mutation<Enrollment, string>({
      query: (enrollmentId) => ({ url: `${enrollmentPath(enrollmentId)}/migrate-version`, method: 'POST' }),
      invalidatesTags: (_r, _e, enrollmentId) => [
        { type: 'Enrollment' as const, id: enrollmentId },
        { type: 'Enrollment' as const, id: LIST_ID },
        { type: 'LearningPlan' as const, id: enrollmentId },
        { type: 'Competency' as const, id: enrollmentId },
      ],
    }),

    /* ── Plan and competencies ─────────────────────────────────────────── */

    getLearningPlan: builder.query<LearningPlan, string>({
      query: (enrollmentId) => ({ url: `${enrollmentPath(enrollmentId)}/plan` }),
      providesTags: (_r, _e, id) => [{ type: 'LearningPlan' as const, id }],
    }),

    getCompetencies: builder.query<Paginated<Competency>, CompetencyListParams>({
      query: ({ enrollmentId, type, search, state, page, limit }) => ({
        url: `${enrollmentPath(enrollmentId)}/competencies`,
        query: compact({ type, search, state, page, limit }),
      }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => filterKey(endpointName, { ...queryArgs }),
      merge: (existing, incoming, { arg }) => mergePage(existing, incoming, arg.page, (i) => i.code),
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: (_r, _e, { enrollmentId }) => [{ type: 'Competency' as const, id: enrollmentId }],
    }),

    /** Opening an item moves NOT_STARTED to IN_PROGRESS (only that); the panel shows the server's answer. */
    openCompetency: builder.mutation<Competency, { enrollmentId: string; code: string }>({
      query: ({ enrollmentId, code }) => ({ url: `${enrollmentPath(enrollmentId)}/competencies/${enc(code)}/open`, method: 'POST' }),
      invalidatesTags: (_r, _e, { enrollmentId }) => [
        { type: 'Competency' as const, id: enrollmentId },
        { type: 'LearningPlan' as const, id: enrollmentId },
        { type: 'Enrollment' as const, id: enrollmentId },
        { type: 'Enrollment' as const, id: LIST_ID },
      ],
    }),

    /** The learner's own 1–5 rating. It NEVER changes the assessed state. */
    setCompetencyConfidence: builder.mutation<Competency, { enrollmentId: string; code: string; selfConfidence: number }>({
      query: ({ enrollmentId, code, selfConfidence }) => ({
        url: `${enrollmentPath(enrollmentId)}/competencies/${enc(code)}/confidence`,
        method: 'PUT',
        body: { selfConfidence },
      }),
      invalidatesTags: (_r, _e, { enrollmentId }) => [{ type: 'Competency' as const, id: enrollmentId }],
    }),

    getAssessments: builder.query<AssessmentAttempt[], { enrollmentId: string; code?: string }>({
      query: ({ enrollmentId, code }) => ({ url: `${enrollmentPath(enrollmentId)}/assessments`, query: compact({ code }) }),
      providesTags: (_r, _e, { enrollmentId }) => [{ type: 'Competency' as const, id: assessmentsTagId(enrollmentId) }],
    }),

    /* ── Evidence (a title, a description and an optional link — no files) ── */

    getEvidence: builder.query<LearningEvidence[], string>({
      query: (enrollmentId) => ({ url: `${enrollmentPath(enrollmentId)}/evidence` }),
      providesTags: (_r, _e, id) => [{ type: 'Competency' as const, id: evidenceTagId(id) }],
    }),

    submitEvidence: builder.mutation<LearningEvidence, SubmitEvidenceRequest>({
      query: ({ enrollmentId, code, title, description, link }) => ({
        url: `${enrollmentPath(enrollmentId)}/evidence`,
        method: 'POST',
        body: { code, title, description, ...(link ? { link } : {}) },
      }),
      invalidatesTags: (_r, _e, { enrollmentId }) => [{ type: 'Competency' as const, id: evidenceTagId(enrollmentId) }],
    }),

    /* ── Tutor ─────────────────────────────────────────────────────────── */

    getTutorSessions: builder.query<TutorSession[], string>({
      query: (enrollmentId) => ({ url: `${enrollmentPath(enrollmentId)}/sessions` }),
      providesTags: (_r, _e, id) => [{ type: 'TutorSession' as const, id }],
    }),

    startTutorSession: builder.mutation<TutorSession, { enrollmentId: string; focusCode?: string }>({
      query: ({ enrollmentId, focusCode }) => ({
        url: `${enrollmentPath(enrollmentId)}/sessions`,
        method: 'POST',
        body: focusCode ? { focusCode } : {},
      }),
      invalidatesTags: (_r, _e, { enrollmentId }) => [
        { type: 'TutorSession' as const, id: enrollmentId },
        { type: 'Enrollment' as const, id: enrollmentId },
        { type: 'Enrollment' as const, id: LIST_ID },
      ],
    }),

    getTutorMessages: builder.query<TutorMessage[], { enrollmentId: string; sessionId: string }>({
      query: ({ enrollmentId, sessionId }) => ({ url: `${sessionPath(enrollmentId, sessionId)}/messages` }),
      providesTags: (_r, _e, { sessionId }) => [{ type: 'TutorSession' as const, id: messagesTagId(sessionId) }],
    }),

    /**
     * 202 with a `turnId`: the reply is produced in the background and read by polling the messages (the
     * screen polls every 2 s while the session's active turn is STREAMING). Tags are invalidated even on
     * failure: a 503 TUTOR_UNAVAILABLE still stored the learner's message.
     */
    sendTutorMessage: builder.mutation<SendTutorMessageResult, SendTutorMessageRequest>({
      query: ({ enrollmentId, sessionId, content, focusCode, idempotencyKey }) => ({
        url: `${sessionPath(enrollmentId, sessionId)}/messages`,
        method: 'POST',
        body: focusCode ? { content, focusCode } : { content },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: (_r, _e, { enrollmentId, sessionId }) => [
        { type: 'TutorSession' as const, id: messagesTagId(sessionId) },
        { type: 'TutorSession' as const, id: enrollmentId },
      ],
    }),

    cancelTutorTurn: builder.mutation<TutorSession, { enrollmentId: string; sessionId: string }>({
      query: ({ enrollmentId, sessionId }) => ({ url: `${sessionPath(enrollmentId, sessionId)}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, _e, { enrollmentId, sessionId }) => [
        { type: 'TutorSession' as const, id: messagesTagId(sessionId) },
        { type: 'TutorSession' as const, id: enrollmentId },
      ],
    }),
  }),
});

export const {
  useGetApprenticeshipsQuery,
  useGetApprenticeshipQuery,
  useGetApprenticeshipKsbsQuery,
  useSetFavouriteMutation,
  useGetApprenticeshipChangelogQuery,
  useGetEnrollmentsQuery,
  useEnrollMutation,
  useGetEnrollmentQuery,
  useUpdateEnrollmentMutation,
  useMigrateEnrollmentVersionMutation,
  useGetLearningPlanQuery,
  useGetCompetenciesQuery,
  useOpenCompetencyMutation,
  useSetCompetencyConfidenceMutation,
  useGetAssessmentsQuery,
  useGetEvidenceQuery,
  useSubmitEvidenceMutation,
  useGetTutorSessionsQuery,
  useStartTutorSessionMutation,
  useGetTutorMessagesQuery,
  useSendTutorMessageMutation,
  useCancelTutorTurnMutation,
} = learningApi;
