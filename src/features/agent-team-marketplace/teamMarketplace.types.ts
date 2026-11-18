/**
 * The Agent Team marketplace — `GET /team-marketplace`, `GET /team-marketplace/:id`
 * and `POST /team-marketplace/:id/clone` on gateway-b2b.
 *
 * A template is platform-owned (no tenant), lists the agent-marketplace entries
 * it installs as its members, and carries what the post-install wizard needs:
 * `defaultObjective` pre-fills the Schedule step, `requiredConnectorSlugs`
 * drives the Connectors step.
 */

export interface MarketplaceTeamMember {
  id: string;
  priority: number;
  /** The agent-marketplace entry this member installs. */
  agentMarketplaceId: string;
  name: string;
  description: string;
  /** The platform has evaluated this agent, so it installs already published. */
  evaluated: boolean;
}

export interface MarketplaceTeam {
  id: string;
  name: string;
  description: string;
  purpose: string;
  /** What the Marketplace groups it under ("Software Company"); null = Other. */
  category: { id: string; slug: string; name: string } | null;
  defaultObjective: string | null;
  requiredConnectorSlugs: string[];
  members: MarketplaceTeamMember[];
  /** Installable: every member agent is evaluated by the platform. */
  ready: boolean;
  /** Live installs across the platform. */
  installCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `name` is sent only on the retry after a 409 `TEAM_NAME_TAKEN`; absent, the
 * server uses the template's own name.
 */
export interface CloneMarketplaceTeamRequest {
  id: string;
  name?: string;
  /** Chosen in the pre-install access dialog. Absent = WORKSPACE. */
  accessMode?: 'WORKSPACE' | 'PRIVATE' | 'SPECIFIC';
  access?: Array<{ userId: string; role: 'VIEWER' | 'RUNNER' | 'EDITOR' }>;
}

/** The `code` gateway-b2b puts on the 409 when the team name is taken. */
export const TEAM_NAME_TAKEN_CODE = 'TEAM_NAME_TAKEN';
