import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

/**
 * Dispatch lives in the sidebar (a drawer screen), and its threads open in the
 * drawer-level ChatConversationStack. The drawer's default back behaviour
 * returns to the FIRST drawer route (the Dashboard), so "back" from a Dispatch
 * thread or the pairing screen goes there explicitly instead: to the Dispatch list.
 */
export function useBackToDispatch() {
  const navigation = useNavigation();
  const goBackToDispatch = useCallback(() => {
    /* Pop what is stacked on top first (e.g. the pairing screen over a thread), then switch drawer route. */
    if ((navigation.getState()?.routes.length ?? 0) > 1) navigation.goBack();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigation.getParent() as any)?.navigate('Dispatch');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackToDispatch();
        return true;
      });
      return () => sub.remove();
    }, [goBackToDispatch]),
  );

  return goBackToDispatch;
}
