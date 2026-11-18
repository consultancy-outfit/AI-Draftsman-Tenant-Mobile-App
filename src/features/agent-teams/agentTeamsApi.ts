/**
 * Agents Teams API — RTK Query endpoints, ported from the web app's
 * `src/store/api/agentTeams.api.ts` and confirmed against the live gateway
 * (`be-api.aidraftsman.ai/api/v1`) on 2026-10-15.
 *
 * Teams, members and schedules. Runs are not here: a team run is driven
 * from inside a chat thread, and web reaches its run page from Chat too.
 *
 * ── WHY EVERY MEMBER CHANGE INVALIDATES THE TEAM ────────────────────────
 * Adding, removing or switching a member off each captures a NEW revision
 * server-side, so the detail read (and the list row's revision number) has
 * to refetch after any of them.
 */
import { api } from '@/store/api';
import { newIdempotencyKey } from '@/utils/ids';

import type { AccessGrant, AccessMode } from './teamAccessRules';

import type {
  AgentTeam,
  AgentTeamListParams,
  AgentTeamMapResponse,
  AgentTeamMember,
  AgentTeamMemberWire,
  AgentTeamPage,
  AgentTeamSchedule,
  AgentTeamsPageWire,
  AgentTeamWire,
  AssignableUser,
  CreateAgentTeamBody,
  CreateScheduleBody,
  CreateTeamThreadBody,
  TeamThreadOption,
  UpdateAgentTeamBody,
} from './agentTeams.types';

/** Rows per page — ten, matching web's numbered pager. */
export const AGENT_TEAMS_PAGE_SIZE = 10;

/** How many of a team's threads the schedule picker offers — web's
 * `SCHEDULE_THREAD_LIMIT`. */
export const SCHEDULE_THREAD_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Wire → app mappers                                                         */
/* -------------------------------------------------------------------------- */

const toMember = (member: AgentTeamMemberWire): AgentTeamMember => ({
  ...member,
  capabilities: member.capabilities ?? [],
  toolGrants: member.toolGrants ?? [],
  /* Zero, not undefined: every reader renders `v{n}`. */
  agentVersion: member.agentVersion ?? 0,
});

/** Every list the screens map over is defaulted here, once — an API that
 * predates a key renders as "nothing there" rather than a thrown TypeError. */
export const toAgentTeam = (wire: AgentTeamWire): AgentTeam => {
  const specialists = (wire.specialists ?? wire.members ?? []).map(toMember);
  return {
    ...wire,
    specialists,
    supervisor: wire.supervisor ? toMember(wire.supervisor) : null,
    memberCount: wire.memberCount ?? specialists.length,
    knowledgeBaseIds: wire.knowledgeBaseIds ?? [],
    connectorInstallIds: wire.connectorInstallIds ?? [],
    origin: wire.origin ?? 'BUILDER',
    conversationId: wire.conversationId ?? null,
    policy: wire.policy ?? null,
    /* A server without per-team access behaves exactly like WORKSPACE with full
       rights — role permissions are then the only gate, as before. */
    accessMode: wire.accessMode ?? 'WORKSPACE',
    createdBy: wire.createdBy ?? null,
    myAccess: wire.myAccess ?? 'MANAGE',
    access: wire.access ?? [],
    readiness: wire.readiness ?? { ready: true, pendingMembers: [] },
  };
};

/** Empty values are DROPPED rather than sent — `?search=` would filter by
 * the empty string on the server. */
const listQuery = (params: AgentTeamListParams | void): Record<string, string | number> => {
  const query: Record<string, string | number> = {};
  if (!params) return query;
  if (params.search?.trim()) query.search = params.search.trim();
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  return query;
};

export const agentTeamsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAgentTeams: builder.query<AgentTeamPage, AgentTeamListParams | void>({
      query: (params) => ({ url: '/agent-teams', query: listQuery(params) }),
      transformResponse: (wire: AgentTeamsPageWire): AgentTeamPage => ({
        items: (wire.items ?? []).map(toAgentTeam),
        total: wire.total ?? 0,
        page: wire.page ?? 1,
        totalPages: wire.totalPages ?? 1,
      }),
      /* One cache entry per page (the default key includes `page`) — a
         numbered pager, not an appending list. */
      providesTags: (result) =>
        result
          ? [...result.items.map((team) => ({ type: 'AgentTeam' as const, id: team.id })), { type: 'AgentTeam' as const, id: 'LIST' }]
          : [{ type: 'AgentTeam', id: 'LIST' }],
    }),

    getAgentTeam: builder.query<AgentTeam, string>({
      query: (id) => ({ url: `/agent-teams/${id}` }),
      transformResponse: toAgentTeam,
      providesTags: (_r, _e, id) => [{ type: 'AgentTeam', id }],
    }),

    /** The design view — every BUILDER team with how it is built, in one
     * read. Tagged with the LIST so a create/edit/delete refreshes it. */
    getAgentTeamMap: builder.query<AgentTeamMapResponse, void>({
      query: () => ({ url: '/agent-teams/map' }),
      providesTags: [{ type: 'AgentTeam', id: 'LIST' }],
    }),

    createAgentTeam: builder.mutation<AgentTeam, CreateAgentTeamBody>({
      query: (body) => ({ url: '/agent-teams', method: 'POST', body }),
      transformResponse: toAgentTeam,
      invalidatesTags: [{ type: 'AgentTeam', id: 'LIST' }],
    }),

    /** Name and purpose only — membership travels on its own routes, each
     * capturing its own revision. */
    updateAgentTeam: builder.mutation<AgentTeam, { id: string; body: UpdateAgentTeamBody }>({
      query: ({ id, body }) => ({ url: `/agent-teams/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'AgentTeam', id }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    /** A soft delete — the only "not active" state a team has. */
    deleteAgentTeam: builder.mutation<void, string>({
      query: (id) => ({ url: `/agent-teams/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'AgentTeam', id: 'LIST' }],
    }),

    addAgentTeamMember: builder.mutation<AgentTeam, { teamId: string; agentId: string }>({
      query: ({ teamId, agentId }) => ({ url: `/agent-teams/${teamId}/members`, method: 'POST', body: { agentId } }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'AgentTeam', id: teamId }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    /** The server refuses removing the LAST member — a team always has one. */
    removeAgentTeamMember: builder.mutation<AgentTeam, { teamId: string; memberId: string }>({
      query: ({ teamId, memberId }) => ({ url: `/agent-teams/${teamId}/members/${memberId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'AgentTeam', id: teamId }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    updateAgentTeamMember: builder.mutation<AgentTeam, { teamId: string; memberId: string; enabled: boolean }>({
      query: ({ teamId, memberId, enabled }) => ({ url: `/agent-teams/${teamId}/members/${memberId}`, method: 'PATCH', body: { enabled } }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'AgentTeam', id: teamId }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    /* --- Schedules ------------------------------------------------------- */

    /** `PUT /agent-teams/:id/access` — replace who may reach the team. Only the
     * creator, the owner or an admin; anyone else gets a 404. */
    setAgentTeamAccess: builder.mutation<AgentTeam, { id: string; accessMode: AccessMode; access: AccessGrant[] }>({
      query: ({ id, ...body }) => ({ url: `/agent-teams/${id}/access`, method: 'PUT', body }),
      transformResponse: (wire: AgentTeamWire) => toAgentTeam(wire),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'AgentTeam', id }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    /** `GET /agent-teams/assignable-users` — who a team can be shared with. */
    getAssignableUsers: builder.query<AssignableUser[], void>({
      query: () => ({ url: '/agent-teams/assignable-users' }),
      transformResponse: (wire: { items?: AssignableUser[] }) => wire.items ?? [],
    }),

    getAgentTeamSchedules: builder.query<AgentTeamSchedule[], string>({
      query: (teamId) => ({ url: `/agent-teams/${teamId}/schedules` }),
      providesTags: (_r, _e, teamId) => [{ type: 'AgentTeamSchedule', id: teamId }],
    }),

    /** `preset` is a LABEL the server maps to a cron — an unknown one is
     * refused, so only `SCHEDULE_PRESETS` values are ever sent. */
    createAgentTeamSchedule: builder.mutation<AgentTeamSchedule, { teamId: string; body: CreateScheduleBody }>({
      query: ({ teamId, body }) => ({
        url: `/agent-teams/${teamId}/schedules`,
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'AgentTeamSchedule', id: teamId }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    /** Pause/resume. Pausing does NOT re-derive the next occurrence. */
    updateAgentTeamSchedule: builder.mutation<AgentTeamSchedule, { teamId: string; scheduleId: string; enabled: boolean }>({
      query: ({ teamId, scheduleId, enabled }) => ({ url: `/agent-teams/${teamId}/schedules/${scheduleId}`, method: 'PATCH', body: { enabled } }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'AgentTeamSchedule', id: teamId }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    deleteAgentTeamSchedule: builder.mutation<{ id: string; deleted: true }, { teamId: string; scheduleId: string }>({
      query: ({ teamId, scheduleId }) => ({ url: `/agent-teams/${teamId}/schedules/${scheduleId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'AgentTeamSchedule', id: teamId }, { type: 'AgentTeam', id: 'LIST' }],
    }),

    /** Fires now without consuming the next scheduled occurrence. A full,
     * charged team run. */
    runAgentTeamScheduleNow: builder.mutation<{ scheduleId: string; occurrenceKey: string }, { teamId: string; scheduleId: string }>({
      query: ({ teamId, scheduleId }) => ({
        url: `/agent-teams/${teamId}/schedules/${scheduleId}/run-now`,
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      }),
    }),

    /** This team's threads, for the schedule form's Thread picker. */
    getTeamThreads: builder.query<TeamThreadOption[], string>({
      query: (teamId) => ({ url: '/conversations', query: { agentTeamId: teamId, limit: SCHEDULE_THREAD_LIMIT } }),
      transformResponse: (wire: { items?: Array<{ id: string; title?: string | null }> }) =>
        (wire.items ?? []).map((t) => ({ id: t.id, title: t.title ?? '' })),
      providesTags: [{ type: 'ChatThread', id: 'LIST' }],
    }),

    /** A thread answered by a team of agents. The server mints the roster
     * for this thread alone — that roster then shows on the Teams list as a
     * `THREAD` team. */
    createTeamThread: builder.mutation<{ id: string; title: string }, CreateTeamThreadBody>({
      query: (body) => ({ url: '/conversations', method: 'POST', body }),
      invalidatesTags: [{ type: 'ChatThread', id: 'LIST' }, { type: 'AgentTeam', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetAgentTeamsQuery,
  useGetAgentTeamQuery,
  useGetAgentTeamMapQuery,
  useCreateAgentTeamMutation,
  useUpdateAgentTeamMutation,
  useDeleteAgentTeamMutation,
  useAddAgentTeamMemberMutation,
  useRemoveAgentTeamMemberMutation,
  useUpdateAgentTeamMemberMutation,
  useGetAgentTeamSchedulesQuery,
  useCreateAgentTeamScheduleMutation,
  useUpdateAgentTeamScheduleMutation,
  useDeleteAgentTeamScheduleMutation,
  useRunAgentTeamScheduleNowMutation,
  useGetTeamThreadsQuery,
  useCreateTeamThreadMutation,
  useSetAgentTeamAccessMutation,
  useGetAssignableUsersQuery,
} = agentTeamsApi;
