import { useMemo } from 'react';

import { useGetAgentTeamsQuery } from '@/features/agent-teams/agentTeamsApi';

import { INSTALLED_LOOKUP_LIMIT } from './teamMarketplace.data';

/**
 * Which templates this workspace already installed: a team built from one carries
 * `clonedFromTeamMarketplaceId`. Returns template id → the team's id (to open it).
 */
export function useInstalledTemplates() {
  const teams = useGetAgentTeamsQuery({ limit: INSTALLED_LOOKUP_LIMIT });
  const workspaceTeams = useMemo(() => (teams.data?.items ?? []).filter((t) => t.origin === 'BUILDER'), [teams.data]);
  const installedIds = useMemo(() => {
    const ids: Record<string, string> = {};
    for (const team of workspaceTeams) {
      if (team.clonedFromTeamMarketplaceId) ids[team.clonedFromTeamMarketplaceId] = team.id;
    }
    return ids;
  }, [workspaceTeams]);
  return { workspaceTeams, installedIds, isLoading: teams.isLoading, refetch: teams.refetch };
}
