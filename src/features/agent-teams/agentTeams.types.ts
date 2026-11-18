/**
 * Agents Teams — domain types, ported from the web app's
 * `src/types/agentTeam.types.ts`, `agentTeamMap.types.ts` and the
 * `AgentTeamSchedule` shape in `agentTeamRun.types.ts` (confirmed against a
 * live `GET /agent-teams` read on 2026-10-15).
 *
 * A team is several deployed agents answering one thread together. ATW v2
 * retired the DRAFT → EVALUATED → DEPLOYED lifecycle: a team is live the
 * moment it exists, and DELETE (a soft delete) is the only way to retire one.
 *
 * Two kinds share the list — `BUILDER` (assembled on the Teams screen) and
 * `THREAD` (the roster a team chat minted for its own conversation).
 */

import type { AccessGrant, AccessMode, MyAccess } from './teamAccessRules';

export type AgentTeamOrigin = 'BUILDER' | 'THREAD';
export type AgentTeamMemberRole = 'SUPERVISOR' | 'SPECIALIST';
export type ToolGrantStatus = 'READY' | 'DISCONNECTED' | 'EXPIRED' | 'DENIED';
export type TeamPartialFailurePolicy = 'FAIL_FAST' | 'CONTINUE_OPTIONAL';

export interface AgentTeamMember {
  /** The membership ROW id — what a remove/toggle addresses. */
  id: string;
  agentId: string;
  /** Frozen at capture; rendered as `v{n}`. Defaulted to 0 when absent. */
  agentVersion: number;
  role: AgentTeamMemberRole;
  name: string;
  modelSlug: string;
  capabilities: string[];
  systemManaged: boolean;
  enabled: boolean;
  toolGrants: Array<{ toolSlug: string; status: ToolGrantStatus; connectorInstallId: string | null }>;
}

export interface AgentTeamPolicy {
  maxParallelTasks: number;
  maxDelegationDepth: number;
  maxTasksPerRun: number;
  maxRuntimeSeconds: number;
  partialFailurePolicy: TeamPartialFailurePolicy;
  approvalRequiredActions: string[];
}

/** Can the team run? Only when every enabled specialist is evaluated and published
 * (an agent edited after publishing drops back to draft and holds the team). */
export interface AgentTeamReadiness {
  ready: boolean;
  pendingMembers: Array<{ agentId: string; name: string; status: string }>;
}

/** `GET /agent-teams/assignable-users` — who a team can be shared with. */
export interface AssignableUser {
  id: string;
  name: string | null;
  email: string;
}

export interface AgentTeam {
  id: string;
  name: string;
  description: string | null;
  /** What the coordinator plans from. The server stores the NAME here when
   * none was given. */
  purpose: string;
  origin: AgentTeamOrigin;
  /** The thread a THREAD roster answers, else null. */
  conversationId: string | null;
  currentRevision: number;
  policy: AgentTeamPolicy | null;
  /** Always null since ATW v2 — kept so a historic v1 team still renders. */
  supervisor: AgentTeamMember | null;
  specialists: AgentTeamMember[];
  memberCount: number;
  knowledgeBaseIds: string[];
  connectorInstallIds: string[];
  /** The team-marketplace template this team was installed from, or null. */
  clonedFromTeamMarketplaceId?: string | null;
  /** Who may reach the team (per-team access). */
  accessMode: AccessMode;
  /** The creator's user id — the implicit owner. Null for machine-made teams. */
  createdBy: string | null;
  /** What THIS caller may do with it. */
  myAccess: MyAccess;
  /** The share list. Sent only to someone who may change it (`myAccess: MANAGE`). */
  access: AccessGrant[];
  readiness: AgentTeamReadiness;
  createdAt: string;
  updatedAt: string;
}

/** Every list the app dereferences is optional on the wire and defaulted
 * by `toAgentTeam` — the same tolerance web's mapper has. */
export type AgentTeamMemberWire = Omit<AgentTeamMember, 'capabilities' | 'toolGrants' | 'agentVersion'> & {
  capabilities?: string[];
  toolGrants?: AgentTeamMember['toolGrants'];
  agentVersion?: number;
};

export interface AgentTeamWire
  extends Omit<
    AgentTeam,
    | 'specialists'
    | 'supervisor'
    | 'memberCount'
    | 'knowledgeBaseIds'
    | 'connectorInstallIds'
    | 'origin'
    | 'conversationId'
    | 'policy'
    | 'readiness'
    | 'accessMode'
    | 'createdBy'
    | 'myAccess'
    | 'access'
  > {
  /** Absent from a server that predates the published-specialists rule. */
  readiness?: AgentTeamReadiness;
  /** Absent from a server that predates per-team access. */
  accessMode?: AccessMode;
  createdBy?: string | null;
  myAccess?: MyAccess;
  access?: AccessGrant[];
  origin?: AgentTeamOrigin;
  conversationId?: string | null;
  policy?: AgentTeamPolicy | null;
  specialists?: AgentTeamMemberWire[];
  /** The presenter's older key for the same list. */
  members?: AgentTeamMemberWire[];
  supervisor?: AgentTeamMemberWire | null;
  memberCount?: number;
  knowledgeBaseIds?: string[];
  connectorInstallIds?: string[];
}

/** OFFSET-paged — `{ items, total, page, limit, totalPages }`. */
export interface AgentTeamsPageWire {
  items: AgentTeamWire[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgentTeamPage {
  items: AgentTeam[];
  total: number;
  page: number;
  totalPages: number;
}

/** `search`, `page`, `limit` — the server's own names. The gateway runs
 * `forbidNonWhitelisted`, so `q` or `cursor` would be a 400. */
export interface AgentTeamListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateAgentTeamBody {
  name: string;
  /** Omitted, never sent empty — the server falls back to the name. */
  purpose?: string;
  /** REQUIRED: at least one, at most eight. */
  memberAgentIds: string[];
}

/** Only the fields an edit may change — built field by field. */
export interface UpdateAgentTeamBody {
  name?: string;
  purpose?: string;
  /** REPLACED wholesale when present; `[]` detaches everything. Set from a
   * team thread's details screen ("Attached to this team"). */
  knowledgeBaseIds?: string[];
  connectorInstallIds?: string[];
}

export interface AgentTeamSchedule {
  id: string;
  teamId: string;
  /** The preset LABEL, which is also the schedule's name. */
  preset: string;
  /** Derived server-side. Shown, never posted. */
  cron: string;
  timezone: string;
  enabled: boolean;
  conversationId: string;
  objective: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export interface CreateScheduleBody {
  preset: string;
  timezone?: string;
  objective: string;
  conversationId?: string;
}

/** Just the two fields the schedule's thread picker reads. */
export interface TeamThreadOption {
  id: string;
  title: string;
}

/** `POST /conversations` in team mode. */
export interface CreateTeamThreadBody {
  title?: string;
  mode: 'AGENT_TEAM';
  agentIds: string[];
  knowledgeBaseId?: string;
}

/* ── The tube map (design view) — `GET /agent-teams/map` ──────────────── */

export interface TmMemberWire {
  agentId: string;
  name: string;
  status: string;
  role: string;
  enabled: boolean;
  priority: number;
  capabilities: Array<{ slug: string; label: string }>;
}

export interface TmTeamWire {
  id: string;
  name: string;
  purpose: string | null;
  revision: number;
  limits: {
    maxParallelTasks: number;
    maxDelegationDepth: number;
    maxTasksPerRun: number;
    maxRuntimeSeconds: number;
  };
  failurePolicy: string;
  approvalRequiredActions: string[];
  knowledgeBases: Array<{ id: string; name: string }>;
  connectors: Array<{ id: string; name: string; slug: string; status: string }>;
  members: TmMemberWire[];
  schedules: { total: number; enabled: number };
  chats: number;
  runs: { total: number; succeeded: number; failed: number };
}

export interface AgentTeamMapResponse {
  teams: TmTeamWire[];
}
