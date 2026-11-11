import type { ApprovalKind, DesktopRun, DeviceTask, DeviceTaskStatus, PhoneScope } from './devices.types';

export const POLL_MS = 3000;
export const PAIRING_POLL_LIMIT_MS = 2 * 60 * 1000;
export const STALE_PROGRESS_MS = 60 * 1000;
export const MAX_TASK_CHARS = 20000;
export const VISIBLE_STEPS = 6;

export const isActiveTask = (t: Pick<DeviceTask, 'status'>) => t.status === 'QUEUED' || t.status === 'CLAIMED';

export const TASK_STATUS_COPY: Record<Exclude<DeviceTaskStatus, 'FAILED'>, string> = {
  QUEUED: 'Waiting for your computer',
  CLAIMED: 'Running on your computer',
  DONE: 'Done. The answer is in the conversation.',
  EXPIRED: 'Your computer did not pick this up in time. Is it on and signed in?',
  CANCELLED: 'Cancelled',
};

export const taskStatusText = (t: DeviceTask) =>
  t.status === 'FAILED' ? t.message || 'The task did not finish.' : TASK_STATUS_COPY[t.status];

export const APPROVAL_WHAT: Record<ApprovalKind, string> = {
  write: 'change a file',
  exec: 'run a command',
  net: 'open a web page',
  publish: 'send a result to your phone',
  other: 'do something',
};

export type Presence = 'online' | 'recent' | 'offline';

export function computerPresence(lastSeenAt: string | null, now = Date.now()): Presence {
  if (!lastSeenAt) return 'offline';
  const age = now - new Date(lastSeenAt).getTime();
  if (age <= 3 * 60 * 1000) return 'online';
  if (age <= 30 * 60 * 1000) return 'recent';
  return 'offline';
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: 'Online',
  recent: 'Seen recently',
  offline: 'Offline',
};

export function isStaleProgress(t: DeviceTask, now = Date.now()): boolean {
  return t.status === 'CLAIMED' && !!t.progressAt && now - new Date(t.progressAt).getTime() > STALE_PROGRESS_MS;
}

/** A 403 that is about the workspace switch, not about this phone's pairing. */
export const isRemoteControlOff = (messages: string[]) => messages.some((m) => /remote control/i.test(m));

/** The pairing QR encodes `{portal}/pair?token=…` — read the token, never open the link. */
export function parsePairingToken(data: string): string | null {
  const m = /[?&]token=([^&#\s]+)/.exec(data);
  if (!m || !m[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/** The 403 for a phone that lacks the any_folder permission (the phone IS still paired). */
export const isFolderNotAllowed = (messages: string[]) => messages.some((m) => /may not name a folder|not allowed to work in a chosen folder|work in any folder/i.test(m));

export const SCOPE_LABEL: Record<PhoneScope, string> = {
  read: 'Read files',
  outputs: 'Send results to the phone',
  delete: 'Delete files',
  shell: 'Run commands',
  connectors: 'Use connectors',
  any_folder: 'Work in any folder',
};

export const FOLDER_NOT_ALLOWED_COPY =
  'This phone is not allowed to work in a chosen folder. On the computer, turn on “Work in any folder” for this phone.';

/** Client-side mirror of the server's folder_path rules, so the common slips are caught before sending. */
export function folderPathProblem(path: string): string | null {
  const p = path.trim();
  if (!p) return null;
  if (p.length > 500) return 'That folder path is too long (500 characters at most).';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(p)) return 'That folder path has characters that are not allowed.';
  if (/(^|[\\/])\.\.([\\/]|$)/.test(p)) return 'Leave out ".." from the folder path.';
  if (p.startsWith('\\\\') || p.startsWith('//')) return 'A network share cannot be used. Type a full path on the computer.';
  if (!/^([a-zA-Z]:[\\/]|\/)/.test(p)) return 'Type the full path, for example D:\\Projects\\sales or /home/me/work.';
  return null;
}

/** The desktop's answer carries `richContent: [{ kind: "desktop_run", ... }]`. */
export function getDesktopRun(richContent: unknown): DesktopRun | null {
  if (!Array.isArray(richContent)) return null;
  const run = richContent.find((x) => x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'desktop_run');
  return (run as DesktopRun | undefined) ?? null;
}

export const DISPATCH_FOLDER_KEY = (conversationId: string) => `dispatch.folder.${conversationId}`;
