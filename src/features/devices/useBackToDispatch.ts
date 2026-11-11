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
