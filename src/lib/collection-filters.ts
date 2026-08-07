import type { CardCopyOut } from "@/lib/slab/types";

export type CollectionCategoryFilter =
  | "all"
  | "auto"
  | "rookie"
  | "numbered"
  | "teams"
  | "by_set";

export function copyTeams(copy: CardCopyOut): string[] {
  const teams =
    copy.card?.subjects
      .map((subject) => subject.team?.trim())
      .filter((team): team is string => Boolean(team)) ?? [];

  return [...new Set(teams)];
}

export function copyHasTeam(copy: CardCopyOut): boolean {
  return copyTeams(copy).length > 0;
}

export function groupByTeam(
  items: CardCopyOut[],
): { team: string; copies: CardCopyOut[] }[] {
  const groups = new Map<string, CardCopyOut[]>();

  for (const copy of items) {
    for (const team of copyTeams(copy)) {
      const current = groups.get(team) ?? [];
      current.push(copy);
      groups.set(team, current);
    }
  }

  return [...groups.entries()].map(([team, copies]) => ({ team, copies }));
}

export type TeamGroupSort = "players_desc" | "cards_desc" | "alpha";

export function countUniqueTeamPlayers(
  copies: CardCopyOut[],
  team: string,
): number {
  const names = new Set<string>();

  for (const copy of copies) {
    for (const subject of copy.card?.subjects ?? []) {
      if (subject.team?.trim() === team && subject.name?.trim()) {
        names.add(subject.name.trim());
      }
    }
  }

  return names.size;
}

export interface TeamGroup {
  team: string;
  copies: CardCopyOut[];
  playerCount: number;
}

export function sortTeamGroups(
  groups: { team: string; copies: CardCopyOut[] }[],
  sort: TeamGroupSort,
): TeamGroup[] {
  const withCounts = groups.map((group) => ({
    ...group,
    playerCount: countUniqueTeamPlayers(group.copies, group.team),
  }));

  return withCounts.sort((a, b) => {
    if (sort === "players_desc") {
      if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount;
      return a.team.localeCompare(b.team);
    }

    if (sort === "cards_desc") {
      if (b.copies.length !== a.copies.length) {
        return b.copies.length - a.copies.length;
      }
      return a.team.localeCompare(b.team);
    }

    return a.team.localeCompare(b.team);
  });
}

export function copySetName(copy: CardCopyOut): string {
  return copy.card?.set_name?.trim() || "Unknown set";
}

export function copyHasSet(copy: CardCopyOut): boolean {
  return Boolean(copy.card?.set_name?.trim());
}

export function groupBySet(
  items: CardCopyOut[],
): { setName: string; copies: CardCopyOut[] }[] {
  const groups = new Map<string, CardCopyOut[]>();

  for (const copy of items) {
    const setName = copySetName(copy);
    const current = groups.get(setName) ?? [];
    current.push(copy);
    groups.set(setName, current);
  }

  return [...groups.entries()].map(([setName, copies]) => ({ setName, copies }));
}

export function setGroupValue(copies: CardCopyOut[]): number {
  return copies.reduce(
    (sum, copy) => sum + Number(copy.market?.fair_market_value ?? 0),
    0,
  );
}

export type SetGroupSort = "cards_desc" | "value_desc" | "alpha";

export interface SetGroup {
  setName: string;
  copies: CardCopyOut[];
  cardCount: number;
  totalValue: number;
  season?: string | null;
  year?: number | null;
  brand?: string | null;
}

export function sortSetGroups(
  groups: { setName: string; copies: CardCopyOut[] }[],
  sort: SetGroupSort,
): SetGroup[] {
  const enriched = groups.map((group) => {
    const sample = group.copies[0]?.card;
    return {
      ...group,
      cardCount: group.copies.length,
      totalValue: setGroupValue(group.copies),
      season: sample?.season,
      year: sample?.year,
      brand: sample?.brand,
    };
  });

  return enriched.sort((a, b) => {
    if (sort === "value_desc") {
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
      return a.setName.localeCompare(b.setName);
    }

    if (sort === "cards_desc") {
      if (b.cardCount !== a.cardCount) return b.cardCount - a.cardCount;
      return a.setName.localeCompare(b.setName);
    }

    return a.setName.localeCompare(b.setName);
  });
}

export function filterByCategory(
  items: CardCopyOut[],
  category: CollectionCategoryFilter,
): CardCopyOut[] {
  if (category === "teams") {
    return items.filter(copyHasTeam);
  }
  if (category === "by_set") {
    return items.filter(copyHasSet);
  }
  return items;
}

export function categoryQueryParams(
  category: CollectionCategoryFilter,
): Record<string, string> {
  switch (category) {
    case "auto":
      return { auto: "true" };
    case "rookie":
      return { rookie: "true" };
    case "numbered":
      return { is_numbered: "true" };
    default:
      return {};
  }
}

export function categoryFetchLimit(_category: CollectionCategoryFilter): number {
  return 100;
}
