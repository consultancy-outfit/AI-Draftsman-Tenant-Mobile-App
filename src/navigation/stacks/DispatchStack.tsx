import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DispatchHomeScreen } from '@/features/devices/DispatchHomeScreen';

import type { DispatchStackParamList } from '../types';

const Stack = createNativeStackNavigator<DispatchStackParamList>();

/** The thread list (or the intro). A thread itself lives in ChatConversationStack so it has no tab bar. */
export function DispatchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DispatchHome" component={DispatchHomeScreen} />
    </Stack.Navigator>
  );
}
