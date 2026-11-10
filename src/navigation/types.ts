import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  OtpVerify: undefined;
  WorkspaceSelect: undefined;
  TotpEnrolment: undefined;
  RecoveryCodes: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  AccountRefused: undefined;
  OnboardingIncomplete: undefined;
};

// ── Per-tab stacks ──────────────────────────────────────────────────────────

export type DashboardStackParamList = {
  DashboardHome: undefined;
  /* All three carry the month the user had selected on the Dashboard when
     they tapped "See all" — so the detail screen shows the same period,
     not always the current month. */
  SpendByDay: { period: string };
  TopBySpend: { period: string };
  RecentRuns: { period: string };
  /** `CustomerFormScreen` reused in-place from the Customers stack — the
     dashboard's "Register customer" quick action and empty-state CTA
     open it inline rather than jumping across to the Customers drawer
     screen, same convention as MarketplaceStack reusing AgentFormScreen. */
  CustomerForm: { id?: string };
  /** `AgentFormScreen` reused in-place from the Company Agents stack —
     the dashboard's "Create agent" quick action opens it inline rather
     than switching tabs, same convention as CustomerForm above. */
  AgentForm: { id?: string; initialPrompt?: string };
};

export type CompanyAgentsStackParamList = {
  CompanyAgentsHome: undefined;
  AgentDetail: { id: string };
  AgentForm: { id?: string; initialPrompt?: string };
  AgentCloneOut: { id: string };
};

export type CustomerAgentsStackParamList = {
  CustomerAgentsHome: undefined;
  CloneDetail: { id: string };
  CloneEdit: { id: string };
};

export type KnowledgeBasesStackParamList = {
  KnowledgeBasesHome: undefined;
  KnowledgeBaseDetail: { id: string };
  KnowledgeBaseEdit: { id?: string };
  KnowledgeBaseUpload: { id: string };
};

export type ChatStackParamList = {
  /** `newTeamThread` arrives from Agents Teams ("New team chat", or a
   * builder team's "Chat"): open on the Teams tab with the New thread form
   * up on "A team of agents", `agentIds` pre-ticked. `nonce` makes a second
   * tap with the same agents still open the form. */
  ChatHome: { newTeamThread?: { agentIds?: string[]; nonce: number } } | undefined;
};

/** A conversation and everything opened from inside one — deliberately its
 * own stack, mounted as a drawer-level sibling of `MainTabs` (see
 * AppDrawer.tsx) rather than nested inside `ChatStackParamList`/`ChatTab`.
 * Living outside the bottom-tab navigator means there is no tab bar
 * occupying screen space here at all, which is what the composer needs to
 * sit flush above the keyboard — nesting it under the tabs meant relying on
 * `AppTabs.tsx`'s reactive `keyboardVisible` hide, a beat late in both
 * directions. */
export type ChatConversationStackParamList = {
  /** `title` is passed through only so the header has something to show
   * before `GET /conversations/:id` resolves — the thread's real name
   * always comes from the query once it lands. */
  ChatConversation: { conversationId: string; title?: string };
  /** The web's right-hand rail: model, retention and the cost readout.
   * A pushed screen here rather than a third column. */
  ChatThreadDetails: { conversationId: string };
  ChatThreadSearch: undefined;
  /** Dispatch: scan the desktop's QR to pair this phone. */
  PairComputer: undefined;
  /** A text file the computer published to this phone. */
  DeviceArtifact: { artifactId: string; computerKeyId: string };
};

export type CustomersStackParamList = {
  CustomersHome: undefined;
  CustomerDetail: { id: string };
  /** No id = register, id present = edit — mirrors AgentForm's convention. */
  CustomerForm: { id?: string };
  CustomerSuspend: { id: string };
  /** The CSV bulk-import flow (its own multi-phase job) — a modal route,
     opened from the registry's header action. */
  CustomerImport: undefined;
};

export type LeadsStackParamList = {
  LeadsHome: undefined;
  LeadDetail: { id: string };
  /** No id = add, id present = edit — mirrors CustomerForm's convention. */
  LeadForm: { id?: string };
  LeadReasoning: undefined;
};

export type LeadCriteriaStackParamList = {
  LeadCriteriaHome: undefined;
  /** No id = create, id present = edit. */
  LeadCriteriaForm: { id?: string };
  LeadCriteriaRules: { id: string };
};

export type PlaygroundStackParamList = {
  PlaygroundHome: undefined;
  /** `AgentFormScreen` reused in-place from the Company Agents stack — "Save
   * as agent" opens it inline, seeded with the prompt currently in the
   * editor, rather than switching tabs. Same convention as Dashboard's and
   * Marketplace's own reuse of this screen. */
  AgentForm: { id?: string; initialPrompt?: string };
};

export type SurveysStackParamList = {
  SurveysHome: undefined;
  /** `title` only so the header has something to show before the read
   * resolves; `tab` opens a given tab. */
  SurveyDetail: { id: string; title?: string; tab?: 'overview' | 'details' | 'form' | 'targeting' | 'responses' };
  SurveyWizard: undefined;
  /** Create when the survey has no schedule, Edit when it has one. */
  SurveyScheduleForm: { surveyId: string };
};

export type MySurveysStackParamList = {
  MySurveysHome: undefined;
  /** `title` only so the header has something before the read resolves. */
  MySurveyFill: { assignmentId: string; title?: string };
};

export type AgentTeamsStackParamList = {
  AgentTeamsHome: undefined;
  /** `name` is passed through only so the header has something to show
   * before `GET /agent-teams/:id` resolves. */
  AgentTeamDetail: { id: string; name?: string };
  /** No id = New team, id present = Edit team. */
  AgentTeamForm: { id?: string };
  AgentTeamAddMember: { teamId: string };
  AgentTeamScheduleForm: { teamId: string };
  /** A new team thread. `agentIds` preselects a builder team's agents —
   * web's `/chat?team=<id>`; absent = "New team chat" with nobody picked. */
  AgentTeamChat: { agentIds?: string[] } | undefined;
};

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
  ConnectorDetail: { slug: string };
  MarketplaceEntryDetail: { resource: 'skill' | 'agent'; id: string };
  OwnedSkillDetail: { catalogueId: string };
  AddSkill: undefined;
  /* Reuses Company Agents' own detail/edit/clone-out screens in place, the
     same way web's OwnedAgentsPanel reuses those dialogs rather than
     navigating away — opening, editing, or cloning out an agent from the
     marketplace must not leave the Marketplace tab. */
  AgentForm: { id?: string; initialPrompt?: string };
  AgentDetail: { id: string };
  AgentCloneOut: { id: string };
};

export type ReportsStackParamList = {
  ReportsHome: undefined;
  /** No id = create, id present = edit. */
  ReportForm: { id?: string };
  /** `name` is passed through only so the header has something to show
   * immediately — mirrors `ChatConversation`'s own `title?` param. */
  ReportLogs: { id: string; name?: string };
};

export type ApiKeysStackParamList = {
  ApiKeysHome: undefined;
  /** No id = create, id present = edit. */
  ApiKeyForm: { id?: string };
  /** `name` is passed through only so the header has something to show
   * immediately — same convention as `ReportLogs`. */
  KeyUsage: { id: string; name?: string };
  RotatingKeys: undefined;
  Policies: undefined;
  /** No id = create, id present = edit. */
  PolicyForm: { id?: string };
  PolicyView: { id: string };
};

export type TeamStackParamList = {
  TeamHome: undefined;
  InviteMember: undefined;
  /** Seeded from the row that opened it — no extra fetch needed. */
  ChangeRole: { id: string; name: string | null; email: string; roleName: string };
};

export type RolesPermissionsStackParamList = {
  RolesHome: undefined;
  /** No id = create, id present = edit — mirrors CustomerForm's convention. */
  RoleForm: { id?: string };
};

export type OrganizationSettingsStackParamList = {
  OrganizationSettingsHome: undefined;
  CreditRateForm: undefined;
};

export type BrandingStackParamList = {
  BrandingHome: undefined;
  BrandForm: undefined;
  /** Only reachable while the tenant has no domain yet — see
   * `DomainFormScreen`'s doc comment. */
  DomainForm: undefined;
};

export type SupportStackParamList = {
  SupportHome: undefined;
  TicketDetail: { id: string };
  RaiseTicket: undefined;
  /** `EditTicket`'s state select can itself route to escalate (choosing
   * "with AiDraftsman") — see `supportRules.ts`'s module doc — so there
   * is no separate "escalate" destination on this stack; escalate and
   * bring-back are both one-tap actions on `TicketDetailScreen` itself,
   * confirmed with `Alert.alert` rather than a pushed screen. */
  EditTicket: { id: string };
  ReplyTicket: { id: string };
  NoteTicket: { id: string };
  /** Reachable only for a full-access session — see `SUPPORT_PERMISSIONS`'s
   * doc comment: `support.sla.manage` has no dedicated slug today. */
  SlaPolicy: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Appearance: undefined;
  Account: undefined;
  /** The three single-field edits off the Account screen (Full name,
   * Username, Job title) share one form screen — see
   * `AccountFieldFormScreen`'s doc comment. */
  AccountFieldForm: { field: 'fullName' | 'username' | 'jobTitle' };
  ChangePassword: undefined;
  UsageCredits: undefined;
  Analytics: undefined;
};

/** The bottom tab bar — five tabs, permission-composed (a tab whose VIEW
 * grant is absent is simply not rendered; Settings always is, mirroring the
 * web's ungated `/settings`). */
export type AppTabParamList = {
  DashboardTab: undefined;
  CompanyAgentsTab: undefined;
  ChatTab: undefined;
  MarketplaceTab: undefined;
  SettingsTab: undefined;
};

/** Everything reachable from the sidebar, plus the tab bar itself as one
 * drawer screen. Each module route below is its own stack so a module can
 * grow nested screens without touching this list again. */
export type AppDrawerParamList = {
  /* Optionally jumps straight to a tab (e.g. the sidebar's own "Dashboard"
     row) — undefined lands on whichever tab react-navigation already has
     active, same as before this carried params. */
  MainTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  ChatConversationStack: NavigatorScreenParams<ChatConversationStackParamList> | undefined;
  CustomerAgents: NavigatorScreenParams<CustomerAgentsStackParamList> | undefined;
  KnowledgeBases: NavigatorScreenParams<KnowledgeBasesStackParamList> | undefined;
  Playground: NavigatorScreenParams<PlaygroundStackParamList> | undefined;
  AgentTeams: NavigatorScreenParams<AgentTeamsStackParamList> | undefined;
  Customers: NavigatorScreenParams<CustomersStackParamList> | undefined;
  Leads: NavigatorScreenParams<LeadsStackParamList> | undefined;
  LeadCriteria: NavigatorScreenParams<LeadCriteriaStackParamList> | undefined;
  Reports: NavigatorScreenParams<ReportsStackParamList> | undefined;
  UsageSpend: undefined;
  Surveys: NavigatorScreenParams<SurveysStackParamList> | undefined;
  MySurveys: NavigatorScreenParams<MySurveysStackParamList> | undefined;
  /**
   * `from` is the drawer route that opened the bell, so Back returns to that
   * screen rather than wherever the drawer's own history happens to point.
   * Optional: a deep link or a call that omits it falls back to `goBack()`.
   */
  Notifications: { from?: string } | undefined;
  ApiKeys: NavigatorScreenParams<ApiKeysStackParamList> | undefined;
  Team: NavigatorScreenParams<TeamStackParamList> | undefined;
  RolesPermissions: NavigatorScreenParams<RolesPermissionsStackParamList> | undefined;
  OrganizationSettings: NavigatorScreenParams<OrganizationSettingsStackParamList> | undefined;
  Branding: NavigatorScreenParams<BrandingStackParamList> | undefined;
  Support: NavigatorScreenParams<SupportStackParamList> | undefined;
};

/** Kept for the root navigator's type surface — the drawer is what actually
 * mounts once `phase === 'authenticated'`. */
export type AppStackParamList = AppDrawerParamList;
