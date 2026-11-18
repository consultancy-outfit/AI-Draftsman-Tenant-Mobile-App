import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useGetTenantSummaryQuery } from '@/features/tenant/tenantApi';
import { usePermission } from '@/permissions/usePermission';
import { useLogoutMutation } from '@/store/authApi';
import { useAppSelector } from '@/store/hooks';
import { useAppTheme } from '@/theme/ThemeContext';

import { useActiveRoutePath } from './activeRoute';
import { DASHBOARD_SIDEBAR_ITEM, SIDEBAR_SECTIONS, type SidebarItem } from './sidebarConfig';

function SidebarRow({ item, active, onPress }: { item: SidebarItem; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  const canView = usePermission(item.permission);
  if (!canView) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, active && { backgroundColor: `${theme.colors.accent}1A` }]}
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: active ? `${theme.colors.accent}33` : theme.colors.statusNeutralBg, borderRadius: theme.radii.md },
        ]}
      >
        <Icon name={item.icon} size={18} color={active ? theme.colors.accent : theme.colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: active ? theme.colors.accent : theme.colors.text,
            fontFamily: active ? theme.fontFamilies.body.semibold : theme.fontFamilies.body.medium,
            fontSize: theme.fontSizes.sm,
          }}
        >
          {item.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Sidebar items whose stack can be left on a detail screen (for example the team opened from the
 * Marketplace). Tapping the item must land on the module's list, not on that stale detail.
 */
const MODULE_HOME_SCREEN: Partial<Record<string, string>> = {
  AgentTeams: 'AgentTeamsHome',
  Apprenticeships: 'ApprenticeshipsHome',
  MyLearning: 'MyLearningHome',
};

export function SidebarContent(props: DrawerContentComponentProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const session = useAppSelector((s) => s.auth.session);
  const { data: tenant } = useGetTenantSummaryQuery();
  const [logout, { isLoading: signingOut }] = useLogoutMutation();

  const goTo = (route: string) => {
    /* The one item (Dashboard) that isn't its own drawer screen — it jumps
       into the tab bar's Dashboard tab instead of navigating to a flat
       route. Everything else here still resolves as a plain drawer
       screen name. */
    if (route === 'MainTabs') {
      props.navigation.navigate('MainTabs', { screen: 'DashboardTab' } as never);
    } else if (MODULE_HOME_SCREEN[route]) {
      (props.navigation.navigate as (name: string, params?: object) => void)(route, { screen: MODULE_HOME_SCREEN[route] });
    } else {
      props.navigation.navigate(route as never);
    }
    props.navigation.closeDrawer();
  };

  /* Which drawer screen is on screen right now — "MainTabs" whenever any
     bottom tab (including Dashboard) is active, one of the module routes
     otherwise. Dashboard needs the extra nested check because it, alone
     among sidebar items, lives a level deeper inside the tab bar rather
     than being a drawer screen in its own right.

     Sourced from RootNavigator's onStateChange tracking (activeRoute.ts),
     NOT props.state — props.state is this Drawer navigator's own local
     state and was confirmed (via on-device testing) to miss focus changes
     that happen inside the nested bottom-tab navigator, so the Dashboard
     row never lit up when the Dashboard tab was selected. The route path
     is reactive to every change anywhere in the tree, so both checks below
     stay correct no matter which navigator the change happened in. */
  const activeRoutePath = useActiveRoutePath();
  const activeDrawerRouteName = activeRoutePath[0];
  const isDashboardActive = activeRoutePath[0] === 'MainTabs' && activeRoutePath[1] === 'DashboardTab';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 12 }}
      >
        <View style={[styles.workspaceCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.xl }]}>
          <View style={[styles.workspaceMark, { backgroundColor: theme.colors.accent, borderRadius: theme.radii.md }]}>
            <Text style={styles.workspaceMarkText}>{(tenant?.name ?? session?.name ?? 'W').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md }} numberOfLines={1}>
              {tenant?.name ?? 'Your workspace'}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }} numberOfLines={1}>
              {tenant ? `${tenant.plan ?? 'Sandbox'} · ${tenant.customerCount} customers` : ' '}
            </Text>
          </View>
        </View>

        <SidebarRow item={DASHBOARD_SIDEBAR_ITEM} active={isDashboardActive} onPress={() => goTo(DASHBOARD_SIDEBAR_ITEM.route)} />

        {SIDEBAR_SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>{section.label}</Text>
            {section.items.map((item) => (
              <SidebarRow key={item.route} item={item} active={activeDrawerRouteName === item.route} onPress={() => goTo(item.route)} />
            ))}
          </View>
        ))}
      </DrawerContentScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          onPress={() => logout()}
          disabled={signingOut}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <View style={[styles.rowIcon, { backgroundColor: theme.colors.statusErrorBg, borderRadius: theme.radii.md }]}>
            <Icon name="logout" size={18} color={theme.colors.statusErrorFg} />
          </View>
          <Text style={{ color: theme.colors.statusErrorFg, fontFamily: theme.fontFamilies.body.medium, fontSize: theme.fontSizes.sm }}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workspaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  workspaceMark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  workspaceMarkText: { color: '#FFFFFF', fontFamily: 'Syne_700Bold', fontSize: 15 },
  section: { marginTop: 16 },
  sectionLabel: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 4,
    marginLeft: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 12,
    borderRadius: 10,
  },
  rowIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
});
