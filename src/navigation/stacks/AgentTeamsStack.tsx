import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddMemberScreen } from '@/features/agent-teams/AddMemberScreen';
import { AgentTeamAccessScreen } from '@/features/agent-teams/AgentTeamAccessScreen';
import { AgentTeamDetailScreen } from '@/features/agent-teams/AgentTeamDetailScreen';
import { AgentTeamFormScreen } from '@/features/agent-teams/AgentTeamFormScreen';
import { AgentTeamsScreen } from '@/features/agent-teams/AgentTeamsScreen';
import { ScheduleFormScreen } from '@/features/agent-teams/ScheduleFormScreen';
import { TeamChatFormScreen } from '@/features/agent-teams/TeamChatFormScreen';

import type { AgentTeamsStackParamList } from '../types';

const Stack = createNativeStackNavigator<AgentTeamsStackParamList>();

export function AgentTeamsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgentTeamsHome" component={AgentTeamsScreen} />
      <Stack.Screen name="AgentTeamDetail" component={AgentTeamDetailScreen} />
      {/* Web's dialogs become modal routes, the convention every other
          module's create/edit form follows here. */}
      <Stack.Screen name="AgentTeamForm" component={AgentTeamFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AgentTeamAddMember" component={AddMemberScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AgentTeamScheduleForm" component={ScheduleFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AgentTeamAccess" component={AgentTeamAccessScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AgentTeamChat" component={TeamChatFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
