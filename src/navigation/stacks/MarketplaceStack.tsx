import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AgentDetailScreen } from '@/features/company-agents/AgentDetailScreen';
import { AgentFormScreen } from '@/features/company-agents/AgentFormScreen';
import { CloneOutScreen } from '@/features/company-agents/CloneOutScreen';
import { MarketplaceTeamDetailScreen } from '@/features/agent-team-marketplace/MarketplaceTeamDetailScreen';
import { TeamInstallScreen } from '@/features/agent-team-marketplace/TeamInstallScreen';
import { TeamInstallWizardScreen } from '@/features/agent-team-marketplace/TeamInstallWizardScreen';
import { AddSkillScreen } from '@/features/marketplace/AddSkillScreen';
import { ConnectorDetailScreen } from '@/features/marketplace/ConnectorDetailScreen';
import { MarketplaceEntryDetailScreen } from '@/features/marketplace/MarketplaceEntryDetailScreen';
import { MarketplaceScreen } from '@/features/marketplace/MarketplaceScreen';
import { OwnedSkillDetailScreen } from '@/features/marketplace/OwnedSkillDetailScreen';

import type { MarketplaceStackParamList } from '../types';

const Stack = createNativeStackNavigator<MarketplaceStackParamList>();

export function MarketplaceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MarketplaceHome" component={MarketplaceScreen} />
      <Stack.Screen name="ConnectorDetail" component={ConnectorDetailScreen} />
      <Stack.Screen name="MarketplaceEntryDetail" component={MarketplaceEntryDetailScreen} />
      <Stack.Screen name="OwnedSkillDetail" component={OwnedSkillDetailScreen} />
      <Stack.Screen name="MarketplaceTeamDetail" component={MarketplaceTeamDetailScreen} />
      <Stack.Screen name="TeamInstall" component={TeamInstallScreen} />
      <Stack.Screen name="TeamInstallWizard" component={TeamInstallWizardScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="AddSkill" component={AddSkillScreen} options={{ presentation: 'modal' }} />
      {/* Company Agents' own detail/edit/clone-out screens, mounted in
          place — see MarketplaceStackParamList's doc comment. */}
      <Stack.Screen name="AgentDetail" component={AgentDetailScreen} />
      <Stack.Screen name="AgentForm" component={AgentFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AgentCloneOut" component={CloneOutScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
