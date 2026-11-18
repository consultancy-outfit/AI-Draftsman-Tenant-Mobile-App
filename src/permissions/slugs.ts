/**
 * Typed permission-slug constants, grouped by module — so a screen writes
 * `PERMISSIONS.CUSTOMER.DELETE` instead of the string literal `'customer.delete'`.
 * Every value here is also a row in catalogue.ts; catalogue.ts is the render
 * source (labels, module grouping, legacy flags), this file is the call-site
 * ergonomics. Mirrors libs/b2b-shared/src/permissions/slugs.ts plus the rest
 * of the atomic catalogue that file's module doesn't cover directly.
 */

export const DASHBOARD_PERMISSIONS = {
  VIEW: 'dashboard.view',
} as const;

export const CHECKLIST_PERMISSIONS = {
  VIEW: 'checklist.view',
  MANAGE: 'checklist.manage',
} as const;

export const CHAT_PERMISSIONS = {
  VIEW: 'chat.view',
  MANAGE: 'chat.manage',
  SEND: 'chat.send',
} as const;

export const PLAYGROUND_PERMISSIONS = {
  VIEW: 'playground.view',
  RUN: 'playground.run',
} as const;

/** Mirrors web's `AGENT_TEAM_PERMISSIONS` (store/api/permissionCatalogue.ts),
 * itself the backend's. `run`, `approve`, `cancel` and `trace` belong to a
 * team RUN, which is driven from inside a chat thread. */
/** Mirrors web's `LEARNING_PERMISSIONS`: `learning.use` gates the AI Learning
 * module (feed, shorts, courses, my progress). The backend seeds it to every
 * system role and guards every `/learning/ai/*` route with it. */
export const LEARNING_PERMISSIONS = {
  USE: 'learning.use',
} as const;

/** Mirrors web's `SURVEY_PERMISSIONS`: MANAGE gates the manager's Surveys
 * module; RESPOND (seeded to every tenant user) gates My Surveys. */
export const SURVEY_PERMISSIONS = {
  MANAGE: 'survey.manage',
  RESPOND: 'survey.respond',
} as const;

export const AGENT_TEAM_PERMISSIONS = {
  VIEW: 'agent_team.view',
  BUILD: 'agent_team.build',
  RUN: 'agent_team.run',
  APPROVE: 'agent_team.approve',
  CANCEL: 'agent_team.cancel',
  SCHEDULE: 'agent_team.schedule',
  DELETE: 'agent_team.delete',
  TRACE: 'agent_team.trace',
} as const;

export const AGENT_PERMISSIONS = {
  VIEW: 'agent.view',
  BUILD: 'agent.build',
  EVALUATE: 'agent.evaluate',
  PUBLISH: 'agent.publish',
  RESTORE: 'agent.restore',
  CLONE: 'agent.clone',
  DELETE: 'agent.delete',
} as const;

export const CLONE_PERMISSIONS = {
  VIEW: 'clone.view',
  MANAGE: 'clone.manage',
  RECLONE: 'clone.reclone',
  DELETE: 'clone.delete',
  PUSH: 'clone.push',
  ROLLBACK: 'clone.rollback',
} as const;

export const KNOWLEDGE_BASE_PERMISSIONS = {
  VIEW: 'knowledge_base.view',
  MANAGE: 'knowledge_base.manage',
  UPLOAD: 'knowledge_base.upload',
  REINDEX: 'knowledge_base.reindex',
  DELETE: 'knowledge_base.delete',
} as const;

export const CUSTOMER_PERMISSIONS = {
  VIEW: 'customer.view',
  CREATE: 'customer.create',
  UPDATE: 'customer.update',
  SUSPEND: 'customer.suspend',
  RESUME: 'customer.resume',
  DELETE: 'customer.delete',
  IMPORT: 'customer.import',
} as const;

export const LEAD_PERMISSIONS = {
  VIEW: 'lead.view',
  CREATE: 'lead.create',
  UPDATE: 'lead.update',
  SCORE: 'lead.score',
  DELETE: 'lead.delete',
} as const;

export const LEAD_CRITERIA_PERMISSIONS = {
  VIEW: 'lead_criteria.view',
  MANAGE: 'lead_criteria.manage',
} as const;

export const REPORT_PERMISSIONS = {
  VIEW: 'report.view',
  MANAGE: 'report.manage',
  RUN: 'report.run',
  DOWNLOAD: 'report.download',
  DELETE: 'report.delete',
} as const;

export const CONNECTOR_PERMISSIONS = {
  VIEW: 'connector.view',
  CONNECT: 'connector.connect',
} as const;

export const MARKETPLACE_PERMISSIONS = {
  VIEW: 'marketplace.view',
  MANAGE: 'marketplace.manage',
  DELETE: 'marketplace.delete',
  INSTALL: 'marketplace.install',
} as const;

export const KEY_PERMISSIONS = {
  VIEW: 'key.view',
  CREATE: 'key.create',
  UPDATE: 'key.update',
  ROTATE: 'key.rotate',
  REVOKE: 'key.revoke',
} as const;

export const KEY_POLICY_PERMISSIONS = {
  VIEW: 'key_policy.view',
  MANAGE: 'key_policy.manage',
  DELETE: 'key_policy.delete',
} as const;

export const USAGE_PERMISSIONS = {
  VIEW: 'usage.view',
  EXPORT: 'usage.export',
} as const;

export const BILLING_PERMISSIONS = {
  VIEW: 'billing.view',
  MANAGE: 'billing.manage',
  TOPUP: 'billing.topup',
} as const;

export const INVOICE_PERMISSIONS = {
  VIEW: 'invoice.view',
} as const;

export const PRICE_OVERRIDE_PERMISSIONS = {
  MANAGE: 'price_override.manage',
  DELETE: 'price_override.delete',
} as const;

export const BRANDING_PERMISSIONS = {
  VIEW: 'branding.view',
  MANAGE: 'branding.manage',
} as const;

export const DOMAIN_PERMISSIONS = {
  MANAGE: 'domain.manage',
  VERIFY: 'domain.verify',
  REMOVE: 'domain.remove',
} as const;

export const MODEL_ALIAS_PERMISSIONS = {
  MANAGE: 'model_alias.manage',
} as const;

export const TEAM_PERMISSIONS = {
  VIEW: 'user.view',
  INVITE: 'user.invite',
  ASSIGN_ROLE: 'user.assign_role',
  REMOVE: 'user.remove',
} as const;

export const ROLE_PERMISSIONS = {
  VIEW: 'role.view',
  PERMISSION_VIEW: 'permission.view',
  CREATE: 'role.create',
  UPDATE: 'role.update',
  DELETE: 'role.delete',
} as const;

export const NOTIFICATION_PERMISSIONS = {
  VIEW: 'notification.view',
  MANAGE: 'notification.manage',
} as const;

export const AUDIT_PERMISSIONS = {
  VIEW: 'audit.view',
  EXPORT: 'audit.export',
} as const;

export const SUPPORT_PERMISSIONS = {
  VIEW: 'support.view',
  CREATE: 'support.create',
  UPDATE: 'support.update',
  REPLY: 'support.reply',
  ESCALATE: 'support.escalate',
  DELETE: 'support.delete',
} as const;

/** The one wildcard slug — see legacyGrants.ts for how it's resolved. */
export const FULL_ACCESS_PERMISSION = '*' as const;
