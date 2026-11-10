import type { ApprovalKind, DeviceTask, DeviceTaskStatus } from './devices.types';

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
