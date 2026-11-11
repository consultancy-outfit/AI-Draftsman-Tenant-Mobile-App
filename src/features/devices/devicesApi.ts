import { api } from '@/store/api';
import type { ApiQueryError, ApiRequestArgs } from '@/store/baseQuery';

import type { ChatThread, ChatThreadPage } from '@/features/chat/chat.types';

import type {
  ClaimPairingResult,
  DeviceApproval,
  DeviceArtifact,
  DeviceArtifactSummary,
  DeviceList,
  DeviceTask,
  SendTaskInput,
} from './devices.types';
import { isFolderNotAllowed, isRemoteControlOff } from './devicesRules';
import { forgetPhoneSecret, loadPhoneSecret } from './phoneSecret';

/**
 * Dispatch endpoints. The /devices routes use the session guard (same cookie
 * as chat) plus the `chat.send` permission. Calls that need the phone's secret
 * read it from the secure store at call time — it never enters Redux state or
 * a URL. Never use the /computer/* routes: they belong to the desktop app.
 */

const FORBIDDEN_STILL_PAIRED = 'FORBIDDEN_STILL_PAIRED';

const NOT_PAIRED: ApiQueryError = {
  status: 403,
  messages: ['This phone is not paired with a computer.'],
  details: undefined,
  code: 'NOT_PAIRED',
  retryAfterSeconds: undefined,
};

/** A 403 that is not about "remote control off" means this phone is no longer paired. */
export const isUnpairedError = (e: unknown): boolean => {
  const err = e as Partial<ApiQueryError> | undefined;
  if (err?.status !== 403) return false;
  /* Already checked against the server: the phone IS still paired. */
  if (err.code === FORBIDDEN_STILL_PAIRED) return false;
  const messages = err.messages ?? [];
  /* The other two 403s are about permissions, not about the pairing. */
  return !isRemoteControlOff(messages) && !isFolderNotAllowed(messages);
};

type BaseQ = (args: ApiRequestArgs) => PromiseLike<{ data?: unknown; error?: unknown }>;

/**
 * A 403 alone never makes the phone forget its secret. Ask the server first:
 * only when this computer has no ACTIVE phone for us is the pairing really
 * gone. If that check fails (offline, 5xx) the secret is kept. Returns the
 * error to hand back to the caller (marked "still paired" when it is).
 */
async function settle403(baseQuery: BaseQ, computerKeyId: string, error: unknown): Promise<ApiQueryError> {
  const err = error as ApiQueryError;
  if (!isUnpairedError(err)) return err;
  const check = await baseQuery({ url: '/devices' });
  const list = check.data as DeviceList | undefined;
  if (check.error || !list) return { ...err, code: FORBIDDEN_STILL_PAIRED };
  const stillActive = list.phones.some((p) => p.computerKeyId === computerKeyId && p.status === 'ACTIVE');
  if (stillActive) return { ...err, code: FORBIDDEN_STILL_PAIRED };
  await forgetPhoneSecret(computerKeyId);
  return err;
}

export const devicesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDevices: build.query<DeviceList, void>({
      query: () => ({ url: '/devices' }),
      providesTags: ['DeviceList'],
    }),

    claimPairing: build.mutation<ClaimPairingResult, { token: string; deviceName: string; secretHash: string }>({
      query: ({ token, deviceName, secretHash }) => ({
        url: '/devices/pairing/claim',
        method: 'POST',
        body: { token, device_name: deviceName.slice(0, 60), secret_hash: secretHash },
      }),
    }),

    removePhone: build.mutation<unknown, { phoneId: string; computerKeyId: string }>({
      queryFn: async ({ phoneId, computerKeyId }, _api, _x, baseQuery) => {
        const res = await baseQuery({ url: `/devices/phones/${phoneId}`, method: 'DELETE' });
        if (res.error) return { error: res.error as ApiQueryError };
        await forgetPhoneSecret(computerKeyId);
        return { data: res.data };
      },
      invalidatesTags: ['DeviceList'],
    }),

    /* Dispatch's own thread list: never mixed with Chat's. */
    getDispatchThreads: build.query<ChatThreadPage, void>({
      query: () => ({ url: '/devices/dispatch/threads', query: { limit: 50 } }),
      providesTags: ['DispatchThread'],
    }),

    createDispatchThread: build.mutation<ChatThread, { title?: string; agentId?: string }>({
      query: ({ title, agentId }) => ({
        url: '/devices/dispatch/threads',
        method: 'POST',
        body: { ...(title ? { title: title.slice(0, 120) } : null), ...(agentId ? { agent_id: agentId } : null) },
      }),
      invalidatesTags: ['DispatchThread'],
    }),

    renameDispatchThread: build.mutation<unknown, { id: string; title: string }>({
      query: ({ id, title }) => ({ url: `/conversations/${id}`, method: 'PATCH', body: { title } }),
      invalidatesTags: ['DispatchThread'],
    }),

    deleteDispatchThread: build.mutation<unknown, { id: string }>({
      query: ({ id }) => ({ url: `/conversations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['DispatchThread'],
    }),

    getDeviceTasks: build.query<DeviceTask[], { conversationId: string }>({
      query: ({ conversationId }) => ({ url: '/devices/tasks', query: { conversation_id: conversationId } }),
      providesTags: ['DeviceTask'],
    }),

    sendDeviceTask: build.mutation<DeviceTask, SendTaskInput>({
      queryFn: async (input, _api, _x, baseQuery) => {
        const secret = await loadPhoneSecret(input.computerKeyId);
        if (!secret) return { error: NOT_PAIRED };
        const res = await baseQuery({
          url: '/devices/tasks',
          method: 'POST',
          body: {
            computer_key_id: input.computerKeyId,
            conversation_id: input.conversationId,
            text: input.text,
            target: input.target,
            ...(input.folderPath ? { folder_path: input.folderPath } : null),
            ...(input.agentName ? { agent_name: input.agentName.slice(0, 120) } : null),
            phone_token: secret,
          },
        } satisfies ApiRequestArgs);
        if (res.error) {
          return { error: await settle403(baseQuery as unknown as BaseQ, input.computerKeyId, res.error) };
        }
        return { data: res.data as DeviceTask };
      },
      invalidatesTags: ['DeviceTask', 'DeviceList', 'DispatchThread'],
    }),

    cancelDeviceTask: build.mutation<unknown, { taskId: string }>({
      query: ({ taskId }) => ({ url: `/devices/tasks/${taskId}`, method: 'DELETE' }),
      invalidatesTags: ['DeviceTask'],
    }),

    getDeviceApprovals: build.query<DeviceApproval[], { conversationId: string }>({
      query: ({ conversationId }) => ({ url: '/devices/approvals', query: { conversation_id: conversationId } }),
      providesTags: ['DeviceApproval'],
    }),

    decideDeviceApproval: build.mutation<
      { id: string; status: 'ALLOWED' | 'DENIED' },
      { approvalId: string; computerKeyId: string; decision: 'allow' | 'deny' }
    >({
      queryFn: async ({ approvalId, computerKeyId, decision }, _api, _x, baseQuery) => {
        const secret = await loadPhoneSecret(computerKeyId);
        if (!secret) return { error: NOT_PAIRED };
        const res = await baseQuery({
          url: `/devices/approvals/${approvalId}/decide`,
          method: 'POST',
          body: { decision, phone_token: secret },
        });
        if (res.error) {
          return { error: await settle403(baseQuery as unknown as BaseQ, computerKeyId, res.error) };
        }
        return { data: res.data as { id: string; status: 'ALLOWED' | 'DENIED' } };
      },
      invalidatesTags: ['DeviceApproval', 'DeviceTask'],
    }),

    getDeviceArtifacts: build.query<DeviceArtifactSummary[], { conversationId: string; computerKeyId: string }>({
      queryFn: async ({ conversationId, computerKeyId }, _api, _x, baseQuery) => {
        const secret = await loadPhoneSecret(computerKeyId);
        if (!secret) return { error: NOT_PAIRED };
        /* The secret goes in a HEADER, never the query string (the server refuses that). */
        const res = await baseQuery({
          url: '/devices/artifacts',
          query: { conversation_id: conversationId },
          headers: { 'x-phone-token': secret },
        });
        if (res.error) {
          return { error: await settle403(baseQuery as unknown as BaseQ, computerKeyId, res.error) };
        }
        return { data: res.data as DeviceArtifactSummary[] };
      },
      providesTags: ['DeviceArtifact'],
    }),

    getDeviceArtifact: build.query<DeviceArtifact, { artifactId: string; computerKeyId: string }>({
      queryFn: async ({ artifactId, computerKeyId }, _api, _x, baseQuery) => {
        const secret = await loadPhoneSecret(computerKeyId);
        if (!secret) return { error: NOT_PAIRED };
        const res = await baseQuery({ url: `/devices/artifacts/${artifactId}`, headers: { 'x-phone-token': secret } });
        if (res.error) {
          return { error: await settle403(baseQuery as unknown as BaseQ, computerKeyId, res.error) };
        }
        return { data: res.data as DeviceArtifact };
      },
    }),
  }),
});

export const {
  useGetDevicesQuery,
  useGetDispatchThreadsQuery,
  useCreateDispatchThreadMutation,
  useRenameDispatchThreadMutation,
  useDeleteDispatchThreadMutation,
  useClaimPairingMutation,
  useRemovePhoneMutation,
  useGetDeviceTasksQuery,
  useSendDeviceTaskMutation,
  useCancelDeviceTaskMutation,
  useGetDeviceApprovalsQuery,
  useDecideDeviceApprovalMutation,
  useGetDeviceArtifactsQuery,
  useGetDeviceArtifactQuery,
} = devicesApi;
