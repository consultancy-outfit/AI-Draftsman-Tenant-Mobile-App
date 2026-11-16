import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from './baseQuery';

/**
 * The shared portal api slice — every non-auth endpoint (dashboard,
 * customers, chat, agents, ...) injects into this one via
 * `api.injectEndpoints`, RTK Query's recommended pattern for a large,
 * feature-sharded API surface. One reducer/middleware pair for the whole
 * portal instead of one per feature, while each feature file still owns
 * its own endpoint definitions and cache tags.
 *
 * `authApi` (src/store/authApi.ts) stays separate deliberately — auth
 * state lives in authSlice via onQueryStarted, not the query cache, and
 * its endpoints (credentials/otp/totp/session) are meaningfully a
 * different lifecycle from everything behind the authenticated shell.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Dashboard',
    'TenantSummary',
    'Notifications',
    'CustomerStats',
    'Limits',
    'Agent',
    'Clone',
    'Customer',
    'CustomerImport',
    'KnowledgeBase',
    'Connector',
    'ConnectorInstall',
    'SkillCategory',
    'AgentCategory',
    'MarketplaceSkill',
    'MarketplaceAgent',
    'ChatThread',
    /* Keyed by conversationId — one transcript entry per thread. */
    'ChatMessage',
    'ChatBalance',
    'ChatModels',
    'Lead',
    'LeadAttachment',
    'LeadCriteria',
    'LeadEvaluationCriterion',
    'Report',
    'ApiKey',
    'KeyPolicy',
    'TeamMember',
    'TeamRole',
    'Role',
    'Permission',
    'OrganizationPricing',
    'Branding',
    'Domain',
    'SupportTicket',
    'SupportSummary',
    'SupportSlaPolicy',
    'SupportDraft',
    'Usage',
    'Account',
    'UsageCredits',
    'Analytics',
    'AgentTeam',
    'AgentTeamSchedule',
    /* Keyed by run id, `THREAD:<conversationId>`, `EVENTS:<runId>` and
       `INTERACTIONS:<runId>`. */
    'AgentTeamRun',
    /* Keyed by survey id, plus `LIST`. */
    'Survey',
    /* Keyed by survey id — schedule, runs, responses, dashboard and
       audience preview each read under their own prefix. */
    'SurveySchedule',
    'SurveyRun',
    'SurveyResponse',
    'SurveyDashboard',
    'SurveyAudience',
    'WorkspaceMember',
    /* The respondent's own assignments, keyed by assignment id + `LIST`. */
    'MySurvey',
    /* Dispatch: paired computers/phones, tasks, approvals, artifacts. */
    'DeviceList','DispatchThread',
    'DeviceTask',
    'DeviceApproval',
    'DeviceArtifact',
  ],
  endpoints: () => ({}),
});
