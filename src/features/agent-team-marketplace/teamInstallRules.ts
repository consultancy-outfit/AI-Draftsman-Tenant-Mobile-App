/**
 * The pure rules behind the Agent Teams install flow, kept free of `@/`
 * imports so `tools/checks/team-marketplace.spec.ts` can load them with the
 * strip-types runner.
 */

/** Must match `TEAM_NAME_TAKEN` in the backend's TeamMarketplaceService. */
const TEAM_NAME_TAKEN = 'TEAM_NAME_TAKEN';

export interface TeamCloneFailure {
  status: number | null;
  /** True only for a 409 whose body carries `code: TEAM_NAME_TAKEN`. */
  nameTaken: boolean;
  message: string;
}

const readMessage = (raw: unknown): string => {
  if (Array.isArray(raw)) {
    return raw.filter((m) => typeof m === 'string').join(' ');
  }
  return typeof raw === 'string' ? raw : '';
};

/**
 * Reads a failed `cloneMarketplaceTeamToTenant` (an RTK `FetchBaseQueryError`).
 * gateway-b2b's `RpcHttpExceptionFilter` passes `{ code, message }` through on
 * the body; `message` may be a string or an array of strings.
 *
 * A 409 WITHOUT the code is not treated as a name clash — the rename dialog
 * would be the wrong answer to a conflict it does not understand.
 */
export const readTeamCloneFailure = (error: unknown): TeamCloneFailure => {
  /* Web's RTK error is `{ status, data: { code, message } }`; this app's base query flattens it to
     `{ status, code, messages }`. Both are read, so the rule is the same on either. */
  const raw = (error ?? {}) as { status?: unknown; data?: unknown; code?: unknown; messages?: unknown };
  const status = typeof raw.status === 'number' ? raw.status : null;
  const body = (raw.data && typeof raw.data === 'object' ? raw.data : {}) as {
    code?: unknown;
    message?: unknown;
  };
  const code = body.code ?? raw.code;
  const message = readMessage(body.message) || readMessage(raw.messages);
  let fallback = 'Could not install that team. Try again.';
  if (status === null) fallback = 'Could not reach the marketplace. Try again.';
  return {
    status,
    nameTaken: status === 409 && code === TEAM_NAME_TAKEN,
    message: message || fallback,
  };
};

/** What the rename dialog pre-fills after a clash: the name plus " (2)". */
export const suggestTeamName = (attempted: string): string => {
  const match = /^(.*) \((\d+)\)$/.exec(attempted);
  if (match) return `${match[1]} (${Number(match[2]) + 1})`;
  return `${attempted} (2)`;
};

interface InstallLike {
  id: string;
  connectorSlug: string;
  status: string;
}

/**
 * The Connectors step's selection before the user touches a checkbox.
 *
 * What the team already has wins (a wizard resumed after an OAuth return, or a
 * team installed earlier). Otherwise: one ACTIVE install per connector the
 * template requires — never a broken install, which would attach a connector
 * the run cannot use.
 */
export const defaultConnectorSelection = (
  currentInstallIds: string[],
  requiredSlugs: string[],
  installs: InstallLike[],
): string[] => {
  if (currentInstallIds.length > 0) return currentInstallIds;
  const ids: string[] = [];
  for (const slug of requiredSlugs) {
    const install = installs.find(
      (i) => i.connectorSlug === slug && i.status === 'active',
    );
    if (install && !ids.includes(install.id)) ids.push(install.id);
  }
  return ids;
};
