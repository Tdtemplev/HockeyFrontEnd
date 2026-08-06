import type { CardCopyOut } from "@/lib/slab/types";

export type CollectionCategoryFilter =
  | "all"
  | "auto"
  | "rookie"
  | "numbered"
  | "teams";

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

  return [...groups.entries()]
    .map(([team, copies]) => ({ team, copies }))
    .sort((a, b) => a.team.localeCompare(b.team));
}

export function filterByCategory(
  items: CardCopyOut[],
  category: CollectionCategoryFilter,
): CardCopyOut[] {
  if (category === "teams") {
    return items.filter(copyHasTeam);
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
