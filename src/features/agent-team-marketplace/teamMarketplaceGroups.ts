/**
 * How the Agent Teams marketplace groups templates: one section per category
 * ("Software Company" and its teams), alphabetical, with uncategorised
 * templates last under "Other". Pure — no `@/` imports — so
 * `tools/checks/team-marketplace.spec.ts` can load it.
 */

export interface GroupableTeam {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
}

/** The chip / section key for templates with no category. */
export const OTHER_CATEGORY = 'other';
/** The chip that shows every section. */
export const ALL_CATEGORIES = 'all';

export interface TeamCategoryGroup<T extends GroupableTeam> {
  key: string;
  name: string;
  teams: T[];
}

export const groupTeamsByCategory = <T extends GroupableTeam>(
  teams: T[],
): Array<TeamCategoryGroup<T>> => {
  const groups = new Map<string, TeamCategoryGroup<T>>();
  for (const team of teams) {
    const key = team.category?.id ?? OTHER_CATEGORY;
    const name = team.category?.name ?? 'Other';
    const group = groups.get(key) ?? { key, name, teams: [] };
    group.teams.push(team);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      teams: [...group.teams].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.key === OTHER_CATEGORY) return 1;
      if (b.key === OTHER_CATEGORY) return -1;
      return a.name.localeCompare(b.name);
    });
};

/** The sections a chip shows: all of them, or the one chosen. */
export const visibleGroups = <T extends GroupableTeam>(
  groups: Array<TeamCategoryGroup<T>>,
  selected: string,
): Array<TeamCategoryGroup<T>> =>
  selected === ALL_CATEGORIES
    ? groups
    : groups.filter((group) => group.key === selected);

/** "Software Company · 10 teams". */
export const groupHeading = (group: { name: string; teams: unknown[] }) =>
  `${group.name} · ${String(group.teams.length)} team${group.teams.length === 1 ? '' : 's'}`;

/** A category chip: "Software Company · 10". */
export const chipLabel = (group: { name: string; teams: unknown[] }) =>
  `${group.name} · ${String(group.teams.length)}`;
