import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useGetDevicesQuery } from './devicesApi';
import type { DeviceComputer, DevicePhone } from './devices.types';
import { loadPhoneSecret } from './phoneSecret';

export interface PairedComputer {
  computer: DeviceComputer;
  phone: DevicePhone;
}

/**
 * The computer this phone is actively paired with: an ACTIVE phone entry on
 * the platform whose secret ALSO exists in this device's secure store.
 * (A pairing made from another device has no secret here, so it doesn't count.)
 */
export function usePairedComputer(opts: { pollMs?: number } = {}) {
  const query = useGetDevicesQuery(undefined, { pollingInterval: opts.pollMs ?? 0, refetchOnFocus: true });
  const [withSecret, setWithSecret] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  /* Bumped whenever the screen is focused: a secret saved while this screen was behind the pairing
     screen is picked up on return, not only when the API data happens to change. */
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => setFocusTick((n) => n + 1), []));

  const activePhones = useMemo(() => (query.data?.phones ?? []).filter((p) => p.status === 'ACTIVE'), [query.data]);
  const keyIds = activePhones.map((p) => p.computerKeyId).join('|');

  useEffect(() => {
    let live = true;
    void Promise.all(activePhones.map(async (p) => ((await loadPhoneSecret(p.computerKeyId)) ? p.computerKeyId : null))).then((ids) => {
      if (!live) return;
      setWithSecret(new Set(ids.filter((x): x is string => !!x)));
      setChecked(true);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyIds, query.data, focusTick]);

  const paired = useMemo<PairedComputer | null>(() => {
    for (const phone of activePhones) {
      if (!withSecret.has(phone.computerKeyId)) continue;
      const computer = query.data?.computers.find((c) => c.id === phone.computerKeyId);
      if (computer) return { computer, phone };
    }
    return null;
  }, [activePhones, withSecret, query.data]);

  /* An ACTIVE phone exists but none of them belongs to a computer this device can use (the computer
     signed out and came back with a new key, or the pairing was made on another device): the person
     has to pair again. Only said once the local secrets have been looked at. */
  const pairedElsewhere = checked && !query.isLoading && !paired && activePhones.length > 0;

  return { paired, pairedElsewhere, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}
