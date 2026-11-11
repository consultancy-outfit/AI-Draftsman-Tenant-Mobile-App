import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { AppHeader } from '@/components/shell/AppHeader';
import { Button, Loader } from '@/components/ui';
import { env } from '@/config/env';
import { useAppTheme } from '@/theme/ThemeContext';

import { useIsFocused } from '@react-navigation/native';
import { useBackToDispatch } from './useBackToDispatch';
import { useClaimPairingMutation, useGetDevicesQuery } from './devicesApi';
import { PAIRING_POLL_LIMIT_MS, POLL_MS, parsePairingToken } from './devicesRules';
import { forgetPhoneSecret, generatePhoneSecret, hashPhoneSecret, savePhoneSecret } from './phoneSecret';

type Phase =
  | { name: 'scan' }
  | { name: 'claiming' }
  | { name: 'waiting'; computerName: string; computerKeyId: string }
  | { name: 'done'; computerName: string }
  | { name: 'error'; message: string; retry: boolean };

const deviceName = () => (Platform.OS === 'ios' ? 'iPhone' : 'Android phone');

/**
 * Pairing: scan the desktop's QR (read its `token` query parameter — never
 * open the link), claim with a secret of our own, then wait for the person to
 * press "Yes, pair it" on the computer.
 */
export function PairComputerScreen() {
  const { theme } = useAppTheme();
  const goBack = useBackToDispatch();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [pasted, setPasted] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ name: 'scan' });
  const [claim] = useClaimPairingMutation();
  const devices = useGetDevicesQuery(undefined, { skip: phase.name !== 'waiting' });
  const handled = useRef(false);
  const startedAt = useRef(0);

  const onScan = async ({ data }: { data: string }) => {
    if (handled.current) return;
    const token = parsePairingToken(data);
    if (!token) return; /* not our QR: keep scanning */
    handled.current = true;
    setPhase({ name: 'claiming' });
    const secret = generatePhoneSecret();
    try {
      const secretHash = await hashPhoneSecret(secret);
      const res = await claim({ token, deviceName: deviceName(), secretHash }).unwrap();
      await savePhoneSecret(res.computer_key_id, secret);
      startedAt.current = Date.now();
      setPhase({ name: 'waiting', computerName: res.computer_name, computerKeyId: res.computer_key_id });
    } catch (err) {
      const status = (err as { status?: number | string })?.status;
      const message =
        status === 403
          ? 'That code belongs to a different account. Sign in as the same person on both.'
          : status === 410
            ? 'That code expired or was already used. Ask the computer for a new one.'
            : status === 429
              ? 'Too many attempts. Wait a moment and try again.'
              : 'Could not pair. Check your connection and try again.';
      setPhase({ name: 'error', message, retry: true });
    }
  };

  /* Poll GET /devices every 3s while this screen is in front, stop after 2 minutes.
     A screen that is not focused (it stays mounted behind the drawer) never polls and
     never touches the saved secret. On timeout the secret is dropped ONLY if the server
     really has no ACTIVE phone for this computer: a confirmation that landed just
     before the limit must not be undone. */
  useEffect(() => {
    if (phase.name !== 'waiting' || !isFocused) return;
    const { computerKeyId } = phase;
    let stopped = false;
    const id = setInterval(() => {
      if (Date.now() - startedAt.current > PAIRING_POLL_LIMIT_MS) {
        clearInterval(id);
        void devices.refetch().then(async (res) => {
          if (stopped) return;
          const active = res.data?.phones.some((p) => p.computerKeyId === computerKeyId && p.status === 'ACTIVE');
          if (active) return; /* the effect below turns this into "done" */
          await forgetPhoneSecret(computerKeyId);
          if (!stopped) setPhase({ name: 'error', message: 'The computer did not confirm the pairing. It was refused or it expired.', retry: true });
        });
        return;
      }
      void devices.refetch();
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name, isFocused]);

  useEffect(() => {
    if (phase.name !== 'waiting') return;
    const hit = devices.data?.phones.find((p) => p.computerKeyId === phase.computerKeyId && p.status === 'ACTIVE');
    if (hit) {
      setPhase({ name: 'done', computerName: phase.computerName });
      /* Paired: leave by itself, the Dispatch tab then opens on its threads. */
      setTimeout(() => goBack(), 1200);
    }
  }, [devices.data, phase]);

  const retry = () => {
    handled.current = false;
    setPhase({ name: 'scan' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Pair your computer" mode="stack" onBack={() => goBack()} />
      <View style={[styles.body, { paddingBottom: 16 + insets.bottom }]}>
        {phase.name === 'scan' &&
          (!permission ? (
            <Loader />
          ) : !permission.granted ? (
            <View style={styles.center}>
              <Text style={[styles.text, { color: theme.colors.text }]}>
                Allow the camera to scan the code on your computer (Computer › Pair a phone).
              </Text>
              <Button label="Allow camera" onPress={() => void requestPermission()} style={styles.self} />
            </View>
          ) : (
            <>
              <Text style={[styles.text, { color: theme.colors.text }]}>On your computer open Computer › Pair a phone, then scan the code. It is valid for 2 minutes.</Text>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={(r) => void onScan(r)}
              />
              {env.isDev && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Development only: paste the pairing link instead of scanning.</Text>
                  <TextInput
                    value={pasted}
                    onChangeText={setPasted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="https://…/pair?token=…"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.paste, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                  />
                  <Button label="Pair with this link" variant="outline" onPress={() => void onScan({ data: pasted })} disabled={!pasted.trim()} />
                </View>
              )}
            </>
          ))}
        {phase.name === 'claiming' && (
          <View style={styles.center}>
            <Loader />
            <Text style={[styles.text, { color: theme.colors.text }]}>Pairing…</Text>
          </View>
        )}
        {phase.name === 'waiting' && (
          <View style={styles.center}>
            <Loader />
            <Text style={[styles.text, { color: theme.colors.text }]}>
              Look at {phase.computerName} and press “Yes, pair it”. You can also choose what this phone may do there.
            </Text>
          </View>
        )}
        {phase.name === 'done' && (
          <View style={styles.center}>
            <Text style={[styles.text, { color: theme.colors.text }]}>Paired with {phase.computerName}.</Text>
            <Button label="Done" onPress={() => goBack()} style={styles.self} />
          </View>
        )}
        {phase.name === 'error' && (
          <View style={styles.center}>
            <Text style={[styles.text, { color: theme.colors.error }]}>{phase.message}</Text>
            {phase.retry && <Button label="Try again" onPress={retry} style={styles.self} />}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  self: { alignSelf: 'center' },
  paste: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  camera: { flex: 1, minHeight: 200, borderRadius: 16, overflow: 'hidden' },
});
