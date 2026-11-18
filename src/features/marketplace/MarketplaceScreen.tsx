import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader } from '@/components/shell/AppHeader';
import { TeamMarketplaceSection } from '@/features/agent-team-marketplace/TeamMarketplaceSection';
import { useAppTheme } from '@/theme/ThemeContext';

import type { MarketplaceStackParamList } from '@/navigation/types';
import { ConnectorCatalogueSection } from './sections/ConnectorCatalogueSection';
import { MarketplaceKindSection } from './sections/MarketplaceKindSection';
import { MARKETPLACE_SCREEN_SUBTITLE } from './marketplaceRules';

type Nav = NativeStackNavigationProp<MarketplaceStackParamList>;

type TopTab = 'connectors' | 'skills' | 'agents' | 'teams';

const TOP_TABS: Array<{ value: TopTab; label: string }> = [
  { value: 'connectors', label: 'Connectors' },
  { value: 'skills', label: 'Skills' },
  { value: 'agents', label: 'Agents' },
  { value: 'teams', label: 'Agent Teams' },
];

/**
 * The Marketplace tab's top-level shell — three collections behind one tab
 * strip, mirroring web's `Connectors.tsx`: Connectors (the integration
 * catalogue, gated at the route level by `connector.view`, already required
 * to reach this screen) and Skills/Agents (each a My-vs-Marketplace toggle
 * via `MarketplaceKindSection`, gated inside on `marketplace.view` since
 * that is a different permission a principal may not hold).
 *
 * Named "Marketplace" here and in the drawer while the underlying stack/
 * route names stay "Connectors"-flavoured, matching web's same naming split.
 */
export function MarketplaceScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<TopTab>('connectors');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title="Marketplace"
        mode="tab"
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onAvatarPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never)}
      />

      <View style={styles.subtitleBlock}>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}>
          {MARKETPLACE_SCREEN_SUBTITLE}
        </Text>
      </View>

      <View style={styles.tabRow}>
        {TOP_TABS.map((t) => {
          const active = tab === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => setTab(t.value)}
              style={[styles.tabChip, { borderRadius: theme.radii.full, backgroundColor: active ? theme.colors.accent : theme.colors.statusNeutralBg }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? theme.colors.textOnAccent : theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'connectors' ? (
        <ConnectorCatalogueSection onOpenConnector={(slug) => navigation.navigate('ConnectorDetail', { slug })} />
      ) : tab === 'skills' ? (
        <MarketplaceKindSection
          resource="skill"
          onOpenEntry={(id) => navigation.navigate('MarketplaceEntryDetail', { resource: 'skill', id })}
          onOpenOwnedSkill={(catalogueId) => navigation.navigate('OwnedSkillDetail', { catalogueId })}
          onAddSkill={() => navigation.navigate('AddSkill')}
        />
      ) : tab === 'teams' ? (
        <TeamMarketplaceSection
          onOpenTemplate={(id) => navigation.navigate('MarketplaceTeamDetail', { id })}
          onOpenTeam={(id, name) =>
            (navigation as unknown as { getParent: (id: string) => { navigate: (...a: unknown[]) => void } | undefined })
              .getParent('RootDrawer')
              ?.navigate('AgentTeams', { screen: 'AgentTeamDetail', params: { id, name } })
          }
        />
      ) : (
        <MarketplaceKindSection
          resource="agent"
          onOpenEntry={(id) => navigation.navigate('MarketplaceEntryDetail', { resource: 'agent', id })}
          onOpenOwnedSkill={() => undefined}
          onAddSkill={() => undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitleBlock: { paddingHorizontal: 16, paddingTop: 12 },
  /* Wraps onto a second line on a narrow phone instead of scrolling sideways. */
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  tabChip: { paddingHorizontal: 16, paddingVertical: 9 },
});
