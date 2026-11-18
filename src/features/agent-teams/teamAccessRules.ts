/**
 * The pure half of the team access editor — free of `@/` imports so
 * `tools/checks/team-access.spec.ts` can load it with the strip-types runner.
 */

export type AccessMode = 'WORKSPACE' | 'PRIVATE' | 'SPECIFIC';
export type AccessRole = 'VIEWER' | 'RUNNER' | 'EDITOR';
export type MyAccess = 'MANAGE' | 'EDIT' | 'USE' | 'VIEW';

export interface AccessGrant {
  userId: string;
  role: AccessRole;
}

export interface AccessValue {
  mode: AccessMode;
  access: AccessGrant[];
}

export const DEFAULT_ACCESS: AccessValue = { mode: 'WORKSPACE', access: [] };

export const ACCESS_MODE_COPY: Record<
  AccessMode,
  { label: string; chip: string; description: string }
> = {
  WORKSPACE: {
    label: 'Company',
    chip: 'Company',
    description: 'Everyone in this workspace can find and use it.',
  },
  PRIVATE: {
    label: 'Only me',
    chip: 'Only me',
    description: 'Only you can see it. Owners and admins still can.',
  },
  SPECIFIC: {
    label: 'Specific members',
    chip: 'Shared',
    description: 'You, plus the people you choose — each with their own role.',
  },
};

export const ACCESS_ROLE_COPY: Record<
  AccessRole,
  { label: string; hint: string }
> = {
  VIEWER: { label: 'Viewer', hint: 'Can see the team and its runs' },
  RUNNER: { label: 'Can use', hint: 'Can also chat with it and run it' },
  EDITOR: {
    label: 'Editor',
    hint: 'Can also edit members, connectors and schedules',
  },
};

/** The new member's starting role: enough to use it, not to change it. */
export const DEFAULT_ROLE: AccessRole = 'RUNNER';

export const addGrant = (value: AccessValue, userId: string): AccessValue =>
  value.access.some((g) => g.userId === userId)
    ? value
    : { ...value, access: [...value.access, { userId, role: DEFAULT_ROLE }] };

export const setGrantRole = (
  value: AccessValue,
  userId: string,
  role: AccessRole,
): AccessValue => ({
  ...value,
  access: value.access.map((g) => (g.userId === userId ? { ...g, role } : g)),
});

export const removeGrant = (
  value: AccessValue,
  userId: string,
): AccessValue => ({
  ...value,
  access: value.access.filter((g) => g.userId !== userId),
});

/**
 * What to send. The share list only travels with SPECIFIC — sending it with
 * another mode would be ignored by the server, and dropping it here keeps the
 * request honest about what it changes.
 */
export const accessPayload = (
  value: AccessValue,
): { accessMode: AccessMode; access: AccessGrant[] } => ({
  accessMode: value.mode,
  access: value.mode === 'SPECIFIC' ? value.access : [],
});

/** SPECIFIC with nobody chosen is just "Only me" said the long way. */
export const accessProblem = (value: AccessValue): string | null =>
  value.mode === 'SPECIFIC' && value.access.length === 0
    ? 'Add at least one person, or choose “Only me”.'
    : null;

/** The list chip: "Company", "Only me" or "Shared · 3". */
export const accessChipLabel = (
  mode: AccessMode,
  sharedWith: number,
): string =>
  mode === 'SPECIFIC' && sharedWith > 0
    ? `${ACCESS_MODE_COPY.SPECIFIC.chip} · ${String(sharedWith)}`
    : ACCESS_MODE_COPY[mode].chip;

/** What the caller's access lets the portal enable on one team. */
export const accessCapabilities = (myAccess: MyAccess) => ({
  canManageAccess: myAccess === 'MANAGE',
  canEdit: myAccess === 'MANAGE' || myAccess === 'EDIT',
  canUse: myAccess !== 'VIEW',
});

/** Delete: anyone (by role) on a Company team; otherwise only who manages it. */
export const canDeleteTeam = (mode: AccessMode, myAccess: MyAccess): boolean =>
  mode === 'WORKSPACE' || myAccess === 'MANAGE';
