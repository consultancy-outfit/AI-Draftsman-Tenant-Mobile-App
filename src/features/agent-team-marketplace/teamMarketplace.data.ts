/** Agent Teams marketplace — static content and limits (ported from the web/desktop `TeamMarketplace.data.ts`). */

/**
 * The whole catalogue is loaded at once (the API's ceiling) and grouped by
 * category on the screen — sections need every team, and the catalogue is small.
 */
export const TEAM_CATALOGUE_LIMIT = 100;
export const TEAM_SEARCH_DEBOUNCE_MS = 300;

/**
 * How many of the workspace's teams are read to mark catalogue cards "Installed".
 * A workspace past that may see an installed template still offering Install —
 * harmless, since the install is idempotent and returns the existing team.
 */
export const INSTALLED_LOOKUP_LIMIT = 100;

export const TEAM_COPY = {
  ownedLabel: 'My teams',
  catalogueLabel: 'Marketplace',
  catalogueLead: 'Published by the platform. Installing a team adds its agents to this workspace and creates the team, ready to run.',
  searchPlaceholder: 'Search agent teams',
  emptyTitle: 'No agent teams published yet',
  emptyDescription: 'When the platform publishes team templates, they will appear here to install.',
  noMatchTitle: 'No teams match that search',
  noMatchDescription: 'Try a different word, or clear the search.',
  errorTitle: 'Could not load the team marketplace',
  errorDescription: 'The marketplace did not answer. Try again in a moment.',
  ownedEmptyTitle: 'No agent teams in this workspace yet',
  ownedEmptyDescription: 'Install one from the marketplace, or build your own on the Agents Teams screen.',
  install: 'Install team',
  installing: 'Installing…',
  installed: 'Installed',
  openTeam: 'Open team',
  notReadyLabel: 'Not ready yet',
  notReady:
    'Some agents on this team are still being evaluated by the platform. It can be installed once every agent is evaluated and published.',
  noInstall: 'Your role cannot install from the marketplace (marketplace.install).',
  success: (name: string) => `“${name}” installed.`,
  renameTitle: 'That team name is taken',
  renameDescription: (name: string) =>
    `This workspace already has a team called “${name}”. Choose another name for the one you are installing.`,
  renameSubmit: 'Install with this name',
  accessTitle: 'Who can use this team?',
  accessLead: 'Choose this before installing, so the team never exists with a wider reach than you intended.',
} as const;
