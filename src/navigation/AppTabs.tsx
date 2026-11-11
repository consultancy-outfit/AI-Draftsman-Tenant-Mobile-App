import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Icon } from '@/components/ui';
import { CHAT_PERMISSIONS, CONNECTOR_PERMISSIONS, AGENT_PERMISSIONS, DASHBOARD_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { useAppTheme } from '@/theme/ThemeContext';

import { ChatStack } from './stacks/ChatStack';
import { CompanyAgentsStack } from './stacks/CompanyAgentsStack';
import { DashboardStack } from './stacks/DashboardStack';
import { MarketplaceStack } from './stacks/MarketplaceStack';
import { SettingsStack } from './stacks/SettingsStack';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

/**
 * The bottom tab bar — five tabs, permission-composed: a tab whose VIEW
 * grant the session lacks is simply not rendered (ordering never changes
 * for the tabs that DO render). Settings carries no gate, mirroring the
 * web's ungated `/settings` — the app is never tab-less. Everything else
 * in the 17-module list lives in the sidebar (see sidebarConfig.ts),
 * reached from the hamburger button each tab-root AppHeader renders.
 */
export function AppTabs() {
  const { theme } = useAppTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const canSeeDashboard = usePermission(DASHBOARD_PERMISSIONS.VIEW);
  const canSeeAgents = usePermission(AGENT_PERMISSIONS.VIEW);
  const canSeeChat = usePermission(CHAT_PERMISSIONS.VIEW);
  const canSeeMarketplace = usePermission(CONNECTOR_PERMISSIONS.VIEW);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: keyboardVisible
          ? { display: 'none' }
          : {
              backgroundColor: theme.colors.tabBarBackground,
              borderTopColor: theme.colors.tabBarBorder,
              borderTopWidth: theme.borders.hairline,
              height: 80,
              paddingBottom: 24,
              paddingTop: 8,
              /* Without this the first/last tab's icon+label sit flush
               * against the screen edge — no different from the content
               * padding every other screen in this app already gets. */
              paddingHorizontal: theme.space('lg'),
            },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: theme.fontFamilies.body.medium,
        },
      }}
    >
      {canSeeDashboard && (
        <Tab.Screen
          name="DashboardTab"
          component={DashboardStack}
          options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Icon name="dashboard" size={size} color={color} /> }}
        />
      )}
      {canSeeAgents && (
        <Tab.Screen
          name="CompanyAgentsTab"
          component={CompanyAgentsStack}
          options={{ title: 'Agents', tabBarIcon: ({ color, size }) => <Icon name="companyAgents" size={size} color={color} /> }}
        />
      )}
      {canSeeChat && (
        <Tab.Screen
          name="ChatTab"
          component={ChatStack}
          options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Icon name="chat" size={size} color={color} /> }}
        />
      )}
      {canSeeMarketplace && (
        <Tab.Screen
          name="MarketplaceTab"
          component={MarketplaceStack}
          options={{ title: 'Marketplace', tabBarIcon: ({ color, size }) => <Icon name="marketplace" size={size} color={color} /> }}
        />
      )}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}
