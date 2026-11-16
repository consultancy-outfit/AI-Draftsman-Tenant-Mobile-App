import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/**
 * Dispatch push notifications (Expo). Everything here is best-effort and
 * GUARDED: expo-notifications is loaded lazily inside try/catch, so a build
 * that does not contain the native module (an older dev client, a simulator
 * without push) simply gets "no push" instead of a crash. The notification
 * text is fixed and never holds a file name or a path (handoff section 9).
 */

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;
function load(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  try {
    /* Without the native module (an older dev client) loading the JS package would only throw. */
    if (!requireOptionalNativeModule('ExpoPushTokenManager')) {
      cached = null;
      return cached;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

export interface DispatchPushData {
  type: 'approval' | 'task';
  conversationId: string;
  taskId?: string;
  approvalId?: string;
  status?: 'DONE' | 'FAILED';
}

/** Reads a notification's data defensively; anything that is not ours is ignored. */
export function parseDispatchPushData(data: unknown): DispatchPushData | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const type = d.type;
  if ((type !== 'approval' && type !== 'task') || typeof d.conversationId !== 'string' || !d.conversationId) return null;
  return {
    type,
    conversationId: d.conversationId,
    taskId: typeof d.taskId === 'string' ? d.taskId : undefined,
    approvalId: typeof d.approvalId === 'string' ? d.approvalId : undefined,
    status: d.status === 'DONE' || d.status === 'FAILED' ? d.status : undefined,
  };
}

/** Show notifications while the app is open too (a permission question must not be missed). */
export function configurePushHandler(): void {
  if (!isPushConfigured()) return;
  const N = load();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch {
    /* no push on this build */
  }
}

/** Push is off until the build is configured for it (see `pushEnabled` in app.config.ts). */
export const isPushConfigured = (): boolean => (Constants.expoConfig?.extra as { pushEnabled?: boolean } | undefined)?.pushEnabled === true;

/** Asks for permission (once) and returns this device's Expo push token, or null. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isPushConfigured()) return null; /* no permission prompt, no registration */
  const N = load();
  if (!N) return null;
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', { name: 'Dispatch', importance: N.AndroidImportance.DEFAULT });
    }
    const current = await N.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) granted = (await N.requestPermissionsAsync()).granted;
    if (!granted) return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const res = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res.data || null;
  } catch {
    /* simulator, no Firebase/APNs credentials, offline: no push, nothing else breaks */
    return null;
  }
}

const KEY = (computerKeyId: string) => `dispatch.push.${computerKeyId}`;

export const loadRegisteredPushToken = (computerKeyId: string) => AsyncStorage.getItem(KEY(computerKeyId)).catch(() => null);
export const saveRegisteredPushToken = (computerKeyId: string, token: string) => AsyncStorage.setItem(KEY(computerKeyId), token).catch(() => undefined);
export const clearRegisteredPushToken = (computerKeyId: string) => AsyncStorage.removeItem(KEY(computerKeyId)).catch(() => undefined);

/** Calls `onOpen` for every tap on one of OUR notifications, including the one that launched the app. */
export function subscribeToPushTaps(onOpen: (data: DispatchPushData) => void): () => void {
  if (!isPushConfigured()) return () => undefined;
  const N = load();
  if (!N) return () => undefined;
  try {
    const handle = (response: { notification: { request: { content: { data: unknown } } } } | null | undefined) => {
      const data = parseDispatchPushData(response?.notification.request.content.data);
      if (data) onOpen(data);
    };
    const sub = N.addNotificationResponseReceivedListener(handle);
    void N.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}
