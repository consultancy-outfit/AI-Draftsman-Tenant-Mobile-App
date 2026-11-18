/**
 * Agent Teams marketplace — RTK Query endpoints on the shared `api` slice (web keeps these on a second
 * `createApi`; one slice here means a clone can invalidate the teams and agents it creates directly).
 *
 *   GET  /team-marketplace         the platform's team templates, paged
 *   GET  /team-marketplace/:id     one template
 *   POST /team-marketplace/:id/clone  install: the server installs each member agent (reusing any this
 *                                  workspace already has) and creates a live team from them. Idempotent per
 *                                  workspace. A 409 with `code: TEAM_NAME_TAKEN` means nothing was written —
 *                                  retry with a `name`.
 */
import { toAgentTeam } from '@/features/agent-teams/agentTeamsApi';
import type { AgentTeam, AgentTeamWire } from '@/features/agent-teams/agentTeams.types';
import { api } from '@/store/api';

import type { CloneMarketplaceTeamRequest, MarketplaceTeam } from './teamMarketplace.types';

export interface MarketplaceTeamList {
  items: MarketplaceTeam[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MarketplaceTeamListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const teamMarketplaceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMarketplaceTeams: builder.query<MarketplaceTeamList, MarketplaceTeamListParams | void>({
      query: (params) => {
        const query: Record<string, string | number> = {};
        if (params?.page) query.page = params.page;
        if (params?.limit) query.limit = params.limit;
        if (params?.search?.trim()) query.search = params.search.trim();
        return { url: '/team-marketplace', query };
      },
      providesTags: (result) => [
        ...(result?.items ?? []).map((t) => ({ type: 'MarketplaceTeam' as const, id: t.id })),
        { type: 'MarketplaceTeam' as const, id: 'LIST' },
      ],
    }),

    getMarketplaceTeam: builder.query<MarketplaceTeam, string>({
      query: (id) => ({ url: `/team-marketplace/${encodeURIComponent(id)}` }),
      providesTags: (_r, _e, id) => [{ type: 'MarketplaceTeam' as const, id }],
    }),

    cloneMarketplaceTeamToTenant: builder.mutation<AgentTeam, CloneMarketplaceTeamRequest>({
      query: ({ id, name, accessMode, access }) => ({
        url: `/team-marketplace/${encodeURIComponent(id)}/clone`,
        method: 'POST',
        body: {
          ...(name ? { name } : {}),
          ...(accessMode ? { accessMode } : {}),
          ...(accessMode === 'SPECIFIC' ? { access: access ?? [] } : {}),
        },
      }),
      transformResponse: (wire: AgentTeamWire) => toAgentTeam(wire),
      /* The team and its member agents are created: My teams, Agents Teams and Company agents all pick them up. */
      invalidatesTags: [
        { type: 'AgentTeam', id: 'LIST' },
        { type: 'Agent', id: 'LIST' },
        { type: 'MarketplaceTeam', id: 'LIST' },
      ],
    }),
  }),
});

export const { useGetMarketplaceTeamsQuery, useGetMarketplaceTeamQuery, useCloneMarketplaceTeamToTenantMutation } = teamMarketplaceApi;
