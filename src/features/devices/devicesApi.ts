import { api } from '@/store/api';
import type { ApiQueryError, ApiRequestArgs } from '@/store/baseQuery';

import type {
  ClaimPairingResult,
  DeviceApproval,
  DeviceArtifact,
  DeviceArtifactSummary,
  DeviceList,
  DeviceTask,
  SendTaskInput,
} from './devices.types';
import { isRemoteControlOff } from './devicesRules';
import { forgetPhoneSecret, loadPhoneSecret } from './phoneSecret';

/**
 * Dispatch endpoints. The /devices routes use the session guard (same cookie
 * as chat) plus the `chat.send` permission. Calls that need the phone's secret
 * read it from the secure store at call time — it never enters Redux state or
 * a URL. Never use the /computer/* routes: they belong to the desktop app.
 */

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
  return err?.status === 403 && !isRemoteControlOff(err.messages ?? []);
};

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
            ...(input.agentName ? { agent_name: input.agentName.slice(0, 120) } : null),
            phone_token: secret,
          },
        } satisfies ApiRequestArgs);
        if (res.error) {
          if (isUnpairedError(res.error)) await forgetPhoneSecret(input.computerKeyId);
          return { error: res.error as ApiQueryError };
        }
        return { data: res.data as DeviceTask };
      },
      invalidatesTags: ['DeviceTask', 'DeviceList'],
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
          if (isUnpairedError(res.error)) await forgetPhoneSecret(computerKeyId);
          return { error: res.error as ApiQueryError };
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
          if (isUnpairedError(res.error)) await forgetPhoneSecret(computerKeyId);
          return { error: res.error as ApiQueryError };
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
          if (isUnpairedError(res.error)) await forgetPhoneSecret(computerKeyId);
          return { error: res.error as ApiQueryError };
        }
        return { data: res.data as DeviceArtifact };
      },
    }),
  }),
});

export const {
  useGetDevicesQuery,
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
