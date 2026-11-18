/**
 * Agents Teams — copy, ceilings and pure rules, ported from the web app's
 * `AgentTeams.data.ts`, `useAgentTeams.tsx`, `agentTeamsRules.ts`,
 * `AgentTeamBuilder.data.ts`, `scheduleTimezones.ts` and
 * `TeamTubeMap/teamJourney.ts`. No React, no store, no network — every
 * decision a screen makes from data alone lives here.
 */
import { accessCapabilities, accessChipLabel, canDeleteTeam } from './teamAccessRules';
import type { AgentTeam, AgentTeamMember, TmTeamWire } from './agentTeams.types';

/* -------------------------------------------------------------------------- */
/* Ceilings — mirrored from web, which mirrors the server                     */
/* -------------------------------------------------------------------------- */

/** `TEAM_CEILINGS.maxMembers` — the whole of it; ATW v2 has no coordinator
 * row occupying a seat. Same number for a team and a team thread. */
export const MAX_TEAM_AGENTS = 8;
export const TEAM_NAME_MAX = 120;
export const TEAM_PURPOSE_MAX = 2000;
export const THREAD_TITLE_MAX = 200;
/** Sent as a message on every occurrence, so it takes a message's cap. */
export const SCHEDULE_OBJECTIVE_MAX = 100_000;
export const SEARCH_DEBOUNCE_MS = 300;

/* -------------------------------------------------------------------------- */
/* Copy — verbatim from web                                                   */
/* -------------------------------------------------------------------------- */

export const AGENT_TEAMS_COPY = {
  title: 'Agents Teams',
  subtitle: 'Several agents answering one thread together',
  emptyTitle: 'No agent teams yet',
  emptyDescription:
    'A team is several of your agents answering together, with a coordinator the platform provides. Build one with New team, or start a team chat — the roster it creates is listed here too.',
  fromChatHint: "Created by a team chat. Its name is the thread's title, and Chat re-opens that thread.",
  noEditPermission: 'You do not have permission to edit teams',
  noDeletePermission: 'You do not have permission to delete teams',
  noEditThisTeam: 'You do not have permission to edit this team',
  noDeleteThisTeam: 'You do not have permission to delete this team',
  noViewTitle: 'You cannot view agent teams',
  noViewDescription: 'Viewing teams needs the "View agent teams" permission. Ask an owner or an admin to grant it.',
} as const;

export const TEAM_FORM_COPY = {
  create: {
    title: 'New team',
    description: 'Pick the agents that answer together. The team is usable straight away — there is nothing to evaluate or deploy first.',
    submitLabel: 'Create team',
  },
  edit: {
    title: 'Edit team',
    description: 'Changing the purpose changes how the coordinator plans. Adding or removing an agent records its own revision.',
    submitLabel: 'Save changes',
  },
  nameHint: 'What this team is called. It is what the Teams list and any thread it answers show.',
  purposeHint: 'What the team is for, in your words — the coordinator plans from this. Leave it blank to use the name.',
  agentsHint: `Who answers when this team is asked something. At least one, at most ${MAX_TEAM_AGENTS}.`,
} as const;

export const DELETE_TEAM_COPY = {
  title: (name: string) => `Delete ${name}?`,
  body: 'The team stops answering and leaves your list. The thread it answered stays readable, and runs already recorded stay in the audit log.',
  confirm: 'Delete team',
} as const;

export const MEMBER_COPY = {
  emptyTitle: 'No specialists yet',
  emptyDescription: 'A coordinator with nobody to delegate to cannot run. Add the deployed agents this team should work through.',
  addTitle: 'Add a specialist',
  addDescription: 'Only deployed agents can be added — the coordinator can delegate only to a member that is live.',
  addSubmit: 'Add to team',
  addHint: 'The agents you can add to this team.',
  addHintNone: 'No agents yet. Create one first — a team is a group of agents you already have.',
  added: 'Member added. The team is on a new revision, so its evaluation needs re-running.',
  removeTitle: (name: string) => `Remove ${name}?`,
  removeBody:
    'The team moves to a new revision and its evaluation will need running again before it can deploy. To take the member out of the next plan without losing it, disable it instead.',
  removed: (name: string) => `${name} removed. The evaluation needs re-running.`,
} as const;

export const SCHEDULE_COPY = {
  title: 'Schedules',
  emptyTitle: 'No schedules',
  empty: 'No schedules yet. Add one and pick a cadence — each schedule gets a thread of its own, where every run is written.',
  spendTitle: 'Each occurrence is charged',
  spendNote: 'Each occurrence is a full team run and is charged like any other. Pause a schedule to stop it without losing it.',
  formTitle: 'Schedule this team',
  formDescription: 'Each occurrence is a full team run, charged like any other, and writes into a thread you can read.',
  formSubmit: 'Create schedule',
  presetHint: 'The server maps this to a schedule. Hourly is the most expensive by a long way.',
  newThreadLabel: 'New thread for this schedule',
  threadHint: 'Leave it as a new thread and one named after this schedule is created, or pick one of this team’s threads.',
  objectiveHint: 'Sent as the message on every occurrence, exactly as if you had typed it.',
  timezoneHint: "The schedule's times are read in this zone. A 09:00 schedule stays at 09:00 across a clock change.",
  created: 'Schedule created. Every occurrence is a full team run and is charged like any other.',
  paused: 'Schedule paused. It keeps its history and can be resumed.',
  resumed: 'Schedule resumed.',
  stopTitle: (preset: string) => `Stop the ${preset} schedule?`,
  stopBody:
    'It stops firing from now on. Its thread and the runs it has already produced are unchanged. To stop it only for a while, pause it instead — a paused schedule keeps its place.',
  stopConfirm: 'Stop it',
  stopped: 'Schedule stopped. Its thread and past runs are unchanged.',
  runStarted:
    "Run started. Its reply will appear in the schedule's thread in Chat — the next scheduled occurrence still happens as planned.",
} as const;

export const TEAM_CHAT_COPY = {
  title: 'New team chat',
  description: 'A thread is answered by one team of agents. They plan together, each answers in its own name, and one final answer is written for you.',
  nameHint: 'Optional — leave it blank and the first message names the thread.',
  agentsHint:
    'Pick the agents that answer this thread. They plan together, each answers in its own name, and one final answer is written for you.',
  kbHint: 'Optional — the documents this thread may answer from.',
  noKnowledgeBase: 'No knowledge base',
  submit: 'Create thread',
} as const;

/* -------------------------------------------------------------------------- */
/* List rows                                                                  */
/* -------------------------------------------------------------------------- */

export interface AgentTeamRow {
  id: string;
  name: string;
  purpose: string;
  origin: AgentTeam['origin'];
  conversationId: string | null;
  specialistCount: number;
  revision: number;
  updatedAt: string;
  /** Both ids per member — the picker speaks agent ids, a removal
   * addresses the membership row. */
  members: Array<{ memberId: string; agentId: string }>;
  /** "Company", "Only me" or "Shared · 3". */
  accessLabel: string;
  /** What the caller's per-team access lets them do (on top of their role). */
  canEditTeam: boolean;
  canDeleteTeam: boolean;
  canUseTeam: boolean;
  canManageAccess: boolean;
  /** False while a specialist is unpublished: the team cannot run. */
  ready: boolean;
  pendingMembers: AgentTeam['readiness']['pendingMembers'];
}

export const toAgentTeamRow = (team: AgentTeam): AgentTeamRow => ({
  id: team.id,
  name: team.name,
  purpose: team.purpose,
  origin: team.origin,
  conversationId: team.conversationId,
  specialistCount: team.specialists.length,
  revision: team.currentRevision,
  updatedAt: team.updatedAt,
  members: team.specialists.map((m) => ({ memberId: m.id, agentId: m.agentId })),
  accessLabel: accessChipLabel(team.accessMode, team.access.length),
  canEditTeam: accessCapabilities(team.myAccess).canEdit,
  canDeleteTeam: canDeleteTeam(team.accessMode, team.myAccess),
  canUseTeam: accessCapabilities(team.myAccess).canUse,
  canManageAccess: accessCapabilities(team.myAccess).canManageAccess,
  ready: team.readiness.ready,
  pendingMembers: team.readiness.pendingMembers,
});

/** Why Chat is disabled on a team, or '' when it is not. */
export const chatBlockedReason = (row: Pick<AgentTeamRow, 'canUseTeam' | 'ready'>): string => {
  if (!row.canUseTeam) return 'You can view this team but not chat with it';
  if (!row.ready) return 'Every specialist must be evaluated and published first';
  return '';
};

/** The purpose under the name — suppressed when it merely repeats the name
 * (a team created without one stores the name as its purpose). */
export const visiblePurpose = (row: { name: string; purpose: string | null }): string | null =>
  row.purpose && row.purpose !== row.name ? row.purpose : null;

/**
 * Where Chat goes for a team. A THREAD roster re-opens its own thread —
 * sending it down the other path would mint a SECOND roster (and a second
 * row on this list) every tap. A BUILDER team starts a new team thread
 * with its agents preselected, as web's `/chat?team=` does.
 */
export type TeamChatTarget = { kind: 'thread'; conversationId: string } | { kind: 'new'; agentIds: string[] };

export const teamChatTarget = (row: Pick<AgentTeamRow, 'origin' | 'conversationId' | 'members'>): TeamChatTarget =>
  row.origin === 'THREAD' && row.conversationId
    ? { kind: 'thread', conversationId: row.conversationId }
    : { kind: 'new', agentIds: row.members.map((m) => m.agentId) };

/** "Open chat" on a roster, "Chat" on a builder team. */
export const chatButtonLabel = (origin: AgentTeam['origin']): string => (origin === 'THREAD' ? 'Open chat' : 'Chat');
/** The detail screen's header button. */
export const detailChatLabel = (origin: AgentTeam['origin']): string => (origin === 'THREAD' ? 'Open chat' : 'Start a thread');

/* -------------------------------------------------------------------------- */
/* Saving an edit                                                             */
/* -------------------------------------------------------------------------- */

export interface TeamEditPlan {
  definitionChanged: boolean;
  nextPurpose: string;
  added: string[];
  removed: Array<{ memberId: string; agentId: string }>;
}

/**
 * What an edit has to send. Additions go FIRST: the server refuses removing
 * the last agent, so swapping the only member out in the other order would
 * be refused halfway. Nothing is sent for a field nobody changed — a PATCH
 * restating the name still captures a revision.
 */
export const planTeamEdit = (
  target: Pick<AgentTeamRow, 'name' | 'purpose' | 'members'>,
  values: { name: string; purpose: string; agentIds: string[] },
): TeamEditPlan => {
  const held = new Set(target.members.map((m) => m.agentId));
  const wanted = new Set(values.agentIds);
  const nextPurpose = values.purpose || values.name;
  return {
    definitionChanged: values.name !== target.name || nextPurpose !== target.purpose,
    nextPurpose,
    added: values.agentIds.filter((id) => !held.has(id)),
    removed: target.members.filter((m) => !wanted.has(m.agentId)),
  };
};

export const planChangesAnything = (plan: TeamEditPlan): boolean =>
  plan.definitionChanged || plan.added.length > 0 || plan.removed.length > 0;

/** A purpose the server filled in FROM the name is shown back blank — the
 * field is optional and defaults to the name. */
export const editablePurpose = (team: { name: string; purpose: string }): string => (team.purpose === team.name ? '' : team.purpose);

/** De-duplicated, trimmed ids — what a checklist gives back, cleaned. */
export const normaliseAgentIds = (ids: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

export interface HierarchyRow {
  agentId: string;
  name: string;
  role: 'SUPERVISOR' | 'SPECIALIST';
  capabilities: string[];
  enabled: boolean;
}

/** The reporting line: the supervisor (on a v1 team that still has one),
 * then its specialists. A disabled member stays in it. */
export const hierarchyRows = (team: Pick<AgentTeam, 'supervisor' | 'specialists'>): HierarchyRow[] => {
  const rows: HierarchyRow[] = [];
  if (team.supervisor) {
    rows.push({ agentId: team.supervisor.agentId, name: team.supervisor.name, role: 'SUPERVISOR', capabilities: [], enabled: true });
  }
  for (const m of team.specialists) {
    rows.push({ agentId: m.agentId, name: m.name, role: 'SPECIALIST', capabilities: [...m.capabilities].sort(), enabled: m.enabled });
  }
  return rows;
};

/** A grant that is not READY — shown as a warning chip on the member. */
export const blockedGrants = (member: AgentTeamMember) => member.toolGrants.filter((g) => g.status !== 'READY');

export const memberVersionLine = (member: AgentTeamMember): string => `v${member.agentVersion} · ${member.modelSlug}`;

/* -------------------------------------------------------------------------- */
/* Schedules                                                                  */
/* -------------------------------------------------------------------------- */

/** Labels, not crons — the server maps each and refuses an unknown one. */
export const SCHEDULE_PRESETS = [
  { value: 'Hourly', label: 'Hourly', hint: '24 runs a day' },
  { value: 'Daily · weekdays 07:00', label: 'Weekdays at 07:00', hint: '5 runs a week' },
  { value: 'Daily · 09:00', label: 'Every day at 09:00', hint: '7 runs a week' },
  { value: 'Weekly · Mondays 09:00', label: 'Mondays at 09:00', hint: '1 run a week' },
  { value: 'Monthly · 1st at 09:00', label: 'The 1st at 09:00', hint: '12 runs a year' },
] as const;

/** Preselected, as web does — weekdays is the cadence most schedules want. */
export const DEFAULT_SCHEDULE_PRESET: string = SCHEDULE_PRESETS[1].value;

export const SCHEDULE_PRESET_OPTIONS = SCHEDULE_PRESETS.map((p) => ({ value: p.value as string, label: `${p.label} — ${p.hint}` }));

/** `—` for a missing time. */
export const formatScheduleTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const FALLBACK_ZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
];

function offsetOf(zone: string, at: Date): string | null {
  try {
    const part = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part) return null;
    if (part === 'GMT') return '+00:00';
    const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(part);
    return match ? `${match[1]}:${match[2] ?? '00'}` : null;
  } catch {
    return null;
  }
}

/** The device's own zone, so "Weekdays at 07:00" means 07:00 where they are. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
  } catch {
    return 'Europe/London';
  }
}

/** Every IANA zone the runtime knows (a fixed list where the engine does not
 * expose `supportedValuesOf`), labelled with its current offset. */
export function timezoneOptions(at: Date = new Date()): Array<{ value: string; label: string }> {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  let zones: string[] = FALLBACK_ZONES;
  try {
    zones = intl.supportedValuesOf?.('timeZone') ?? FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }
  const device = deviceTimezone();
  const base = zones.includes('UTC') ? zones : ['UTC', ...zones];
  const list = base.includes(device) ? base : [...base, device];
  return list
    .map((zone) => {
      const offset = offsetOf(zone, at);
      return { value: zone, label: offset ? `(UTC${offset}) ${zone.replace(/_/g, ' ')}` : zone.replace(/_/g, ' '), offset };
    })
    .sort((a, b) => (a.offset === b.offset ? a.value.localeCompare(b.value) : (a.offset ?? '').localeCompare(b.offset ?? '')))
    .map(({ value, label }) => ({ value, label }));
}

/* -------------------------------------------------------------------------- */
/* The tube map — design view                                                 */
/* -------------------------------------------------------------------------- */

export const TUBE_COPY = {
  searchPlaceholder: 'Find a team or stop',
  emptyTitle: 'No agent teams to map yet',
  emptyDescription:
    'Build a team and its design will appear here: what starts it, who is in it, what they may do, what it carries, its guardrails and what it has done.',
  errorTitle: 'The tube map could not be loaded',
  errorMessage: 'Something went wrong reading the data behind it.',
  noMatches: 'No team or stop matches that search.',
  stationHint: 'Tap any stop to see what it is and which teams run through it.',
  dashedMeaning:
    'A dashed stop needs a look: a member that is switched off or not deployed, a connector that is not active, a team never used, or runs that did not succeed.',
} as const;

export const TEAM_STAGES = [
  { key: 'team', label: '1 · Team', hint: 'The agent team', noun: 'Agent team' },
  { key: 'trigger', label: '2 · Trigger', hint: 'What starts it', noun: 'Trigger' },
  { key: 'members', label: '3 · Members', hint: 'Who is in it', noun: 'Member' },
  { key: 'capabilities', label: '4 · Capabilities', hint: 'What they may do', noun: 'Capability' },
  { key: 'attached', label: '5 · Attached', hint: 'Knowledge and connectors', noun: 'Attachment' },
  { key: 'guardrails', label: '6 · Guardrails', hint: 'When it stops or asks', noun: 'Guardrail' },
  { key: 'usage', label: '7 · Usage', hint: 'What it has done', noun: 'Usage' },
] as const;

export type TeamStageKey = (typeof TEAM_STAGES)[number]['key'];

export const POLICY_LABELS: Record<string, string> = {
  FAIL_FAST: 'Stops on the first failure',
  CONTINUE_OPTIONAL: 'Carries on past optional failures',
};

export const prettyAction = (action: string): string => {
  const text = action.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export interface StopFacts {
  role: 'team' | 'trigger' | 'member' | 'capability' | 'attachment' | 'guardrail' | 'usage';
  trigger?: 'request' | 'schedule';
  memberRole?: string;
  agentStatus?: string;
  enabled?: boolean;
  capability?: string;
  attachment?: 'kb' | 'connector' | 'none';
  installStatus?: string;
  policy?: string;
  approval?: string;
  chats?: number;
  runs?: number;
  failed?: number;
}

export interface TubeStop {
  id: string;
  stage: TeamStageKey;
  label: string;
  sublabel: string | null;
  facts: StopFacts;
  /** Drawn dashed — "needs a look". */
  dashed: boolean;
}

export interface TubeLine {
  id: string;
  name: string;
  team: TmTeamWire;
  stops: TubeStop[];
}

/** A stop as the map knows it — with the teams that pass through it. */
export interface TubeStation extends TubeStop {
  noun: string;
  lineIds: string[];
  /** Shared by more than one team. */
  isInterchange: boolean;
  /** The first or last stop on some line. */
  isTerminus: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type StopInput = Omit<TubeStop, 'dashed' | 'sublabel'> & { sublabel?: string | null; dashed?: boolean };
const stop = (s: StopInput): TubeStop => ({ ...s, sublabel: s.sublabel ?? null, dashed: s.dashed ?? false });

/** One team's stops, stage by stage — a straight port of web's `stopsOf`. */
export const teamStops = (team: TmTeamWire): TubeStop[] => {
  const stops: TubeStop[] = [];

  stops.push(stop({ id: `team:${team.id}`, stage: 'team', label: team.name, sublabel: `Revision ${team.revision}`, facts: { role: 'team' } }));

  /* Every team can be asked; a schedule is added when one is enabled. */
  stops.push(stop({ id: 'trigger:request', stage: 'trigger', label: 'On request', sublabel: 'A chat message or API call', facts: { role: 'trigger', trigger: 'request' } }));
  if (team.schedules.enabled > 0) {
    stops.push(stop({ id: 'trigger:schedule', stage: 'trigger', label: 'On a schedule', sublabel: 'Runs by itself', facts: { role: 'trigger', trigger: 'schedule' } }));
  }

  const members = [...team.members].sort((a, b) => {
    const sup = Number(b.role === 'SUPERVISOR') - Number(a.role === 'SUPERVISOR');
    return sup || a.priority - b.priority;
  });
  for (const m of members) {
    stops.push(
      stop({
        id: `member:${m.agentId}:${m.role}`,
        stage: 'members',
        label: m.name,
        sublabel: `${m.role.charAt(0)}${m.role.slice(1).toLowerCase()}${m.enabled ? '' : ' · switched off'}`,
        facts: { role: 'member', memberRole: m.role, agentStatus: m.status, enabled: m.enabled },
        dashed: !(m.enabled && m.status === 'DEPLOYED'),
      }),
    );
  }

  const caps = new Map<string, string>();
  for (const m of team.members) {
    if (!m.enabled) continue;
    for (const c of m.capabilities) caps.set(c.slug, c.label);
  }
  for (const [slug, label] of caps) {
    stops.push(stop({ id: `cap:${slug}`, stage: 'capabilities', label, sublabel: 'Capability', facts: { role: 'capability', capability: slug } }));
  }
  if (caps.size === 0) {
    stops.push(stop({ id: 'cap:none', stage: 'capabilities', label: 'No capabilities set', sublabel: 'Members take any task', facts: { role: 'capability', capability: 'none' } }));
  }

  for (const kb of team.knowledgeBases) {
    stops.push(stop({ id: `kb:${kb.id}`, stage: 'attached', label: kb.name, sublabel: 'Knowledge base', facts: { role: 'attachment', attachment: 'kb' } }));
  }
  for (const c of team.connectors) {
    stops.push(
      stop({
        id: `conn:${c.id}`,
        stage: 'attached',
        label: c.name,
        sublabel: 'Connector',
        facts: { role: 'attachment', attachment: 'connector', installStatus: c.status },
        dashed: c.status !== 'active',
      }),
    );
  }
  if (team.knowledgeBases.length === 0 && team.connectors.length === 0) {
    stops.push(stop({ id: 'attach:none', stage: 'attached', label: 'Nothing attached', facts: { role: 'attachment', attachment: 'none' } }));
  }

  stops.push(
    stop({
      id: `policy:${team.failurePolicy}`,
      stage: 'guardrails',
      label: POLICY_LABELS[team.failurePolicy] ?? team.failurePolicy,
      sublabel: 'On a failed task',
      facts: { role: 'guardrail', policy: team.failurePolicy },
    }),
  );
  for (const action of team.approvalRequiredActions) {
    stops.push(stop({ id: `approval:${action}`, stage: 'guardrails', label: prettyAction(action), sublabel: 'Waits for a person', facts: { role: 'guardrail', approval: action } }));
  }
  if (team.approvalRequiredActions.length === 0) {
    stops.push(stop({ id: 'approval:none', stage: 'guardrails', label: 'No approvals required', facts: { role: 'guardrail', approval: 'none' } }));
  }

  const used = team.chats > 0 || team.runs.total > 0;
  stops.push(
    stop({
      id: `usage:${team.id}`,
      stage: 'usage',
      label: used ? `${plural(team.chats, 'chat')} · ${plural(team.runs.total, 'run')}` : 'No chats or runs yet',
      sublabel: team.runs.failed > 0 ? `${team.runs.failed} did not succeed` : null,
      facts: { role: 'usage', chats: team.chats, runs: team.runs.total, failed: team.runs.failed },
      dashed: !used || team.runs.failed > 0,
    }),
  );

  return stops;
};

export interface TubeModel {
  lines: TubeLine[];
  stations: Map<string, TubeStation>;
}

/** Lines (one per team) plus a station index — the same stop id on two
 * lines is ONE station, which is what makes it an interchange. */
export const buildTubeModel = (teams: readonly TmTeamWire[]): TubeModel => {
  const lines: TubeLine[] = teams.map((team) => ({ id: team.id, name: team.name, team, stops: teamStops(team) }));
  const stations = new Map<string, TubeStation>();
  for (const line of lines) {
    line.stops.forEach((s, index) => {
      const terminus = index === 0 || index === line.stops.length - 1;
      const existing = stations.get(s.id);
      if (existing) {
        if (!existing.lineIds.includes(line.id)) existing.lineIds.push(line.id);
        existing.isInterchange = existing.lineIds.length > 1;
        existing.isTerminus = existing.isTerminus || terminus;
        existing.dashed = existing.dashed || s.dashed;
      } else {
        const noun = TEAM_STAGES.find((st) => st.key === s.stage)?.noun ?? '';
        stations.set(s.id, { ...s, noun, lineIds: [line.id], isInterchange: false, isTerminus: terminus });
      }
    });
  }
  return { lines, stations };
};

/** A team matches when its name or any of its stops does. */
export const filterTubeLines = (lines: readonly TubeLine[], query: string): TubeLine[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...lines];
  return lines.filter(
    (line) =>
      line.name.toLowerCase().includes(q) || line.stops.some((s) => s.label.toLowerCase().includes(q) || (s.sublabel ?? '').toLowerCase().includes(q)),
  );
};

/** Plain-language facts for a tapped stop: label/value rows, or one
 * sentence when there is nothing to tabulate. */
export const stopFactRows = (station: Pick<TubeStation, 'facts'>): Array<{ label: string; value: string }> | string => {
  const f = station.facts;
  switch (f.role) {
    case 'trigger':
      return f.trigger === 'schedule'
        ? 'The team has at least one enabled schedule, so it also starts without anybody asking.'
        : 'A chat message or an API call starts a run. Every team can be asked.';
    case 'member':
      return [
        { label: 'Role on the team', value: f.memberRole ?? '—' },
        { label: 'Agent state', value: f.agentStatus ?? '—' },
        { label: 'On the team', value: f.enabled ? 'Switched on' : 'Switched off' },
      ];
    case 'capability':
      return f.capability === 'none'
        ? 'No member has a capability set, so nothing narrows what a task may be handed to.'
        : [{ label: 'Capability', value: f.capability ?? '—' }];
    case 'attachment':
      if (f.attachment === 'none') return 'The team carries no knowledge base and no connector of its own.';
      return f.attachment === 'connector' ? [{ label: 'Install state', value: f.installStatus ?? '—' }] : [{ label: 'Kind', value: 'Knowledge base' }];
    case 'guardrail':
      if (f.policy) return [{ label: 'On a failed task', value: POLICY_LABELS[f.policy] ?? f.policy }];
      return f.approval === 'none' ? 'Nothing waits for a person; every action runs when it is reached.' : [{ label: 'Action', value: prettyAction(f.approval ?? '') }];
    case 'usage':
      return [
        { label: 'Chats', value: String(f.chats ?? 0) },
        { label: 'Runs', value: String(f.runs ?? 0) },
        { label: 'Did not succeed', value: String(f.failed ?? 0) },
      ];
    default:
      return [];
  }
};

/** The followed team's summary rows — web's `TeamDetail`. */
export const teamSummaryRows = (team: TmTeamWire): Array<{ label: string; value: string }> => [
  { label: 'Revision', value: String(team.revision) },
  { label: 'Members', value: String(team.members.length) },
  { label: 'On a failed task', value: POLICY_LABELS[team.failurePolicy] ?? team.failurePolicy },
  { label: 'Waits for approval', value: team.approvalRequiredActions.length ? team.approvalRequiredActions.map(prettyAction).join(', ') : 'Nothing' },
  {
    label: 'Limits',
    value: `${team.limits.maxParallelTasks} parallel · depth ${team.limits.maxDelegationDepth} · ${team.limits.maxTasksPerRun} tasks · ${Math.round(team.limits.maxRuntimeSeconds / 60)} min`,
  },
  { label: 'Schedules', value: `${team.schedules.enabled} of ${team.schedules.total} enabled` },
  {
    label: 'Chats and runs',
    value: `${team.chats} chats · ${team.runs.total} runs${team.runs.failed > 0 ? ` (${team.runs.failed} did not succeed)` : ''}`,
  },
];

/** Up to two initials for a member avatar — "Test Links" → "TL". */
export const memberInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words[words.length - 1]![0]}`;
  return letters.toUpperCase();
};
