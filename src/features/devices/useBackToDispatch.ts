import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

/**
 * ChatConversationStack is a drawer-level stack that outlives its screens: leaving through the drawer
 * does not pop it, so older screens (a thread, the pairing screen) stay underneath. A plain `goBack()`
 * would reveal them, and the drawer's own back goes to the FIRST drawer route (the Dashboard). So
 * "back" leaves explicitly to the drawer route the screen belongs to.
 *
 * Pops what sits above the current screen first, then switches drawer route; also owns Android's
 * hardware back.
 */
export function useBackToDrawerRoute(route: 'Dispatch' | 'MainTabs') {
  const navigation = useNavigation();
  const leave = useCallback(() => {
    if ((navigation.getState()?.routes.length ?? 0) > 1) navigation.goBack();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigation.getParent() as any)?.navigate(route);
  }, [navigation, route]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  return leave;
}

/** Dispatch lives in the sidebar; its threads and the pairing screen go back to the Dispatch list. */
export const useBackToDispatch = () => useBackToDrawerRoute('Dispatch');
