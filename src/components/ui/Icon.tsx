import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import { useAppTheme } from '@/theme/ThemeContext';

/**
 * Every glyph name below is a real key in the installed MaterialIcons
 * glyphmap (verified against
 * node_modules/@expo/vector-icons/.../glyphmaps/MaterialIcons.json before
 * writing this table — not assumed from the web app's icon names).
 *
 * ── PARITY NOTE ───────────────────────────────────────────────────────────
 * The web app uses @mui/icons-material's *Rounded* variants for five nav
 * icons (HomeRounded, SettingsRounded, ChatBubbleOutlineRounded, RuleRounded,
 * SellRounded — see 02-NAVIGATION-AND-PHASE-ORDER.md). This font ships only
 * the base (non-Rounded) Material Icons theme, so those five render as the
 * sharp-cornered variant rather than pixel-identical to web. Everything else
 * below is the same glyph web uses. Exact parity on the five would mean
 * shipping the Material Symbols Rounded variable font instead — noted as a
 * deliberate, disclosed tradeoff rather than silently shipping an
 * approximation; revisit if design flags it in QA.
 *
 * `chat` is a deliberate additional deviation from that parity note: web
 * uses the outline bubble (ChatBubbleOutlineRounded), but in this app's
 * bottom tab bar every other icon (home, smart-toy, extension, settings) is
 * a solid/filled glyph, so the outline bubble was the one visually
 * "lighter" icon among five otherwise-filled ones — swapped to the filled
 * `chat-bubble` to read as the same weight as its neighbours.
 */
export const NAV_ICON_MAP = {
  dashboard: 'home',
  companyAgents: 'smart-toy',
  chat: 'chat-bubble',
  marketplace: 'extension',
  settings: 'settings',
  customerAgents: 'groups',
  knowledgeBases: 'menu-book',
  playground: 'science',
  /* Web's AccountTreeIcon — the same glyph. */
  agentTeams: 'account-tree',
  surveys: 'poll',
  mySurveys: 'assignment',
  dispatch: 'computer',
  customers: 'business',
  leads: 'trending-up',
  leadCriteria: 'rule',
  reports: 'assessment',
  usageAndSpend: 'bar-chart',
  apiKeys: 'key',
  team: 'people',
  rolesAndPermissions: 'admin-panel-settings',
  organizationSettings: 'sell',
  brandingDomain: 'palette',
  support: 'support-agent',
} as const satisfies Record<string, ComponentProps<typeof MaterialIcons>['name']>;

export type NavIconKey = keyof typeof NAV_ICON_MAP;
export type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface IconProps {
  /** Any MaterialIcons glyph name, or one of the nav keys above. */
  name: IconName | NavIconKey;
  size?: number;
  color?: string;
}

function resolveName(name: IconName | NavIconKey): IconName {
  return name in NAV_ICON_MAP ? NAV_ICON_MAP[name as NavIconKey] : (name as IconName);
}

export function Icon({ name, size = 22, color }: IconProps) {
  const { theme } = useAppTheme();
  return <MaterialIcons name={resolveName(name)} size={size} color={color ?? theme.colors.text} />;
}
