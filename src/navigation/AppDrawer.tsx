import { createDrawerNavigator } from '@react-navigation/drawer';

import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';
import { UsageSpendScreen } from '@/features/usage-spend/UsageSpendScreen';

import { AppTabs } from './AppTabs';
import { AgentTeamsStack } from './stacks/AgentTeamsStack';
import { MySurveysStack } from './stacks/MySurveysStack';
import { SurveysStack } from './stacks/SurveysStack';
import { SidebarContent } from './SidebarContent';
import { ApiKeysStack } from './stacks/ApiKeysStack';
import { BrandingStack } from './stacks/BrandingStack';
import { ChatConversationStack } from './stacks/ChatConversationStack';
import { CustomerAgentsStack } from './stacks/CustomerAgentsStack';
import { DispatchStack } from './stacks/DispatchStack';
import { CustomersStack } from './stacks/CustomersStack';
import { KnowledgeBasesStack } from './stacks/KnowledgeBasesStack';
import { LeadCriteriaStack } from './stacks/LeadCriteriaStack';
import { OrganizationSettingsStack } from './stacks/OrganizationSettingsStack';
import { LeadsStack } from './stacks/LeadsStack';
import { PlaygroundStack } from './stacks/PlaygroundStack';
import { ReportsStack } from './stacks/ReportsStack';
import { RolesPermissionsStack } from './stacks/RolesPermissionsStack';
import { SupportStack } from './stacks/SupportStack';
import { TeamStack } from './stacks/TeamStack';
import type { AppDrawerParamList } from './types';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

/**
 * The authenticated shell's true root: a drawer (the sidebar) wrapping the
 * bottom-tab navigator as one screen, plus one screen per module that
 * didn't become a tab — see sidebarConfig.ts for the grouped list the
 * sidebar itself renders. `id="RootDrawer"` lets a screen nested inside a
 * tab's stack reach this navigator via `navigation.getParent('RootDrawer')`
 * without walking an untyped chain.
 */
export function AppDrawer() {
  return (
    <Drawer.Navigator
      id="RootDrawer"
      screenOptions={{ headerShown: false, drawerType: 'front', swipeEdgeWidth: 40 }}
      drawerContent={(props) => <SidebarContent {...props} />}
    >
      <Drawer.Screen name="MainTabs" component={AppTabs} />
      <Drawer.Screen name="ChatConversationStack" component={ChatConversationStack} />
      <Drawer.Screen name="CustomerAgents" component={CustomerAgentsStack} />
      <Drawer.Screen name="KnowledgeBases" component={KnowledgeBasesStack} />
      <Drawer.Screen name="Playground" component={PlaygroundStack} />
      <Drawer.Screen name="AgentTeams" component={AgentTeamsStack} />
      <Drawer.Screen name="Dispatch" component={DispatchStack} />
      <Drawer.Screen name="Customers" component={CustomersStack} />
      <Drawer.Screen name="Leads" component={LeadsStack} />
      <Drawer.Screen name="LeadCriteria" component={LeadCriteriaStack} />
      <Drawer.Screen name="Reports" component={ReportsStack} />
      <Drawer.Screen name="UsageSpend" component={UsageSpendScreen} />
      <Drawer.Screen name="Surveys" component={SurveysStack} />
      <Drawer.Screen name="MySurveys" component={MySurveysStack} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} />
      <Drawer.Screen name="ApiKeys" component={ApiKeysStack} />
      <Drawer.Screen name="Team" component={TeamStack} />
      <Drawer.Screen name="RolesPermissions" component={RolesPermissionsStack} />
      <Drawer.Screen name="Branding" component={BrandingStack} />
      <Drawer.Screen name="OrganizationSettings" component={OrganizationSettingsStack} />
      <Drawer.Screen name="Support" component={SupportStack} />
    </Drawer.Navigator>
  );
}
