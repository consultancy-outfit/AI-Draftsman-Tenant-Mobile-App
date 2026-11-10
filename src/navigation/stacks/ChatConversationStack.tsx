import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatConversationScreen } from '@/features/chat/ChatConversationScreen';
import { ChatThreadDetailsScreen } from '@/features/chat/ChatThreadDetailsScreen';
import { ChatThreadSearchScreen } from '@/features/chat/ChatThreadSearchScreen';

import { DeviceArtifactScreen } from '@/features/devices/DeviceArtifactScreen';
import { PairComputerScreen } from '@/features/devices/PairComputerScreen';

import type { ChatConversationStackParamList } from '../types';

const Stack = createNativeStackNavigator<ChatConversationStackParamList>();

/**
 * A conversation, opened as its own drawer-level stack rather than nested
 * inside ChatStack/the bottom tabs — see the param list's own note. Reached
 * from ChatScreen via `navigation.getParent()?.getParent()?.navigate(...)`,
 * the same cross-navigator jump TopBySpendScreen.tsx uses to reach
 * `Customers`.
 */
export function ChatConversationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatConversation" component={ChatConversationScreen} />
      <Stack.Screen name="ChatThreadDetails" component={ChatThreadDetailsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ChatThreadSearch" component={ChatThreadSearchScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PairComputer" component={PairComputerScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="DeviceArtifact" component={DeviceArtifactScreen} />
    </Stack.Navigator>
  );
}
