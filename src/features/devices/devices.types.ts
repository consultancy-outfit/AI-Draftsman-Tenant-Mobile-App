/** Dispatch ("send work to my computer") wire types — see the mobile handoff doc. */

export type PhoneScope = 'read' | 'outputs' | 'delete' | 'shell' | 'connectors' | 'any_folder';

export interface DeviceComputer {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface DevicePhone {
  id: string;
  computerKeyId: string;
  name: string;
  scopes: PhoneScope[];
  status: 'ACTIVE' | 'REVOKED';
  lastSeenAt: string | null;
  createdAt: string;
}

export interface DeviceList {
  computers: DeviceComputer[];
  phones: DevicePhone[];
}

export interface ClaimPairingResult {
  pairing_id: string;
  computer_name: string;
  computer_key_id: string;
}

export type DeviceTaskStatus = 'QUEUED' | 'CLAIMED' | 'DONE' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface ProgressStep {
  tool: string;
  label: string;
  state: 'running' | 'done' | 'failed';
}

export interface DeviceTask {
  id: string;
  conversationId: string;
  status: DeviceTaskStatus;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  progress: { steps: ProgressStep[] } | null;
  progressAt: string | null;
}

export interface SendTaskInput {
  computerKeyId: string;
  conversationId: string;
  text: string;
  target: string;
  agentName?: string;
  /** Full path of a folder on the computer (needs the any_folder permission). */
  folderPath?: string;
}

export type ApprovalKind = 'write' | 'exec' | 'net' | 'publish' | 'other';

export interface DeviceApproval {
  id: string;
  taskId: string;
  conversationId: string;
  toolName: string;
  kind: ApprovalKind;
  label: string;
  detail: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface DeviceArtifactSummary {
  id: string;
  taskId: string;
  conversationId: string;
  title: string;
  filename: string;
  mimeType: 'text/markdown' | 'text/plain' | 'text/csv' | 'application/json' | 'text/html';
  sizeBytes: number;
  sha256: string;
  version: number;
  createdAt: string;
}

export interface DeviceArtifact extends DeviceArtifactSummary {
  content: string;
}

/** One entry in a desktop answer's `richContent` (kind "desktop_run"). */
export interface DesktopRun {
  kind: 'desktop_run';
  outcome: 'completed' | 'stopped' | 'failed';
  /** The FULL path in Dispatch threads, or "This computer" when no folder was involved. */
  folderName: string;
  steps: Array<{ tool: string; label: string; ok: boolean }>;
}
