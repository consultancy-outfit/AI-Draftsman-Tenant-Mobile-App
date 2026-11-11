import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useRegisterPushTokenMutation } from './devicesApi';
import { configurePushHandler, getExpoPushToken, loadRegisteredPushToken, saveRegisteredPushToken } from './pushNotifications';
import { usePairedComputer } from './usePairedComputer';

/**
 * Registers this phone's Expo push token with the platform once a computer is
 * paired (and again if the token changes). Renders nothing. A failure just
 * means no push this session; the app polls as before.
 */
export function DispatchPushRegistrar() {
  const { paired } = usePairedComputer();
  const [register] = useRegisterPushTokenMutation();
  const computerKeyId = paired?.computer.id ?? null;

  useEffect(() => {
    configurePushHandler();
  }, []);

  useEffect(() => {
    if (!computerKeyId) return;
    let live = true;
    void (async () => {
      const token = await getExpoPushToken();
      if (!token || !live) return;
      if ((await loadRegisteredPushToken(computerKeyId)) === token) return;
      try {
        await register({ computerKeyId, expoToken: token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }).unwrap();
        await saveRegisteredPushToken(computerKeyId, token);
      } catch {
        /* 429 / offline / not paired any more: try again next launch */
      }
    })();
    return () => {
      live = false;
    };
  }, [computerKeyId, register]);

  return null;
}
