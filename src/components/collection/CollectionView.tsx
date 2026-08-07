"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { CardListRow } from "@/components/collection/CardListRow";
import { CardTile } from "@/components/collection/CardTile";
import { CollectionFilterStats } from "@/components/collection/CollectionFilterStats";
import { CollectionSetBanners } from "@/components/collection/CollectionSetBanners";
import { CollectionTeamGroups } from "@/components/collection/CollectionTeamGroups";
import { SetupPrompt } from "@/components/collection/SetupPrompt";
import { SummaryBar } from "@/components/collection/SummaryBar";
import { formatApiDetail } from "@/lib/api-errors";
import {
  categoryFetchLimit,
  categoryQueryParams,
  filterByCategory,
  type CollectionCategoryFilter,
} from "@/lib/collection-filters";
import { compareCardNumbers, compareLastName } from "@/lib/names";
import { primarySubjectName } from "@/components/collection/PlayerAvatar";
import type { CardCopyOut, CollectionResult, DashboardStats } from "@/lib/slab/types";
import { confidenceScore } from "@/lib/slab/confidence";

type SortOption =
  | "value_desc"
  | "confidence_desc"
  | "card_number_asc"
  | "card_number_desc"
  | "alpha_asc";

type ViewMode = "grid" | "list";

const SORT_TO_API: Partial<Record<SortOption, string>> = {
  value_desc: "-fmv",
};

function sortClientSide(items: CardCopyOut[], sort: SortOption): CardCopyOut[] {
  const sorted = [...items];

  if (sort === "card_number_asc") {
    return sorted.sort((a, b) =>
      compareCardNumbers(a.card?.card_number, b.card?.card_number),
    );
  }

  if (sort === "card_number_desc") {
    return sorted.sort((a, b) =>
      compareCardNumbers(b.card?.card_number, a.card?.card_number),
    );
  }

  if (sort === "confidence_desc") {
    return sorted.sort((a, b) => {
      const confA = confidenceScore(
        a.market?.sample_size,
        a.market?.low_confidence,
      );
      const confB = confidenceScore(
        b.market?.sample_size,
        b.market?.low_confidence,
      );
      if (confB !== confA) return confB - confA;
      return (b.market?.sample_size ?? 0) - (a.market?.sample_size ?? 0);
    });
  }

  if (sort === "alpha_asc") {
    return sorted.sort((a, b) =>
      compareLastName(
        primarySubjectName(a.card?.subjects),
        primarySubjectName(b.card?.subjects),
      ),
    );
  }

  return sorted;
}

export function CollectionView() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("value_desc");
  const [view, setView] = useState<ViewMode>("grid");
  const [category, setCategory] = useState<CollectionCategoryFilter>("all");
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadCollection = useCallback(
    (
      search?: string,
      nextSort?: SortOption,
      nextCategory?: CollectionCategoryFilter,
    ) => {
      startTransition(async () => {
        setError(null);

        const activeCategory = nextCategory ?? category;
        const params = new URLSearchParams();
        if (search) params.set("q", search);

        const apiSort = SORT_TO_API[nextSort ?? sort];
        if (apiSort) params.set("sort", apiSort);
        params.set("limit", String(categoryFetchLimit(activeCategory)));

        for (const [key, value] of Object.entries(
          categoryQueryParams(activeCategory),
        )) {
          params.set(key, value);
        }

        const response = await fetch(`/api/collection?${params.toString()}`);

        if (response.status === 503) {
          setNeedsSetup(true);
          return;
        }

        if (!response.ok) {
          const body = (await response.json()) as { detail?: unknown };
          setError(formatApiDetail(body.detail, "Failed to load collection"));
          return;
        }

        const data = (await response.json()) as CollectionResult;
        setResult(data);
        setNeedsSetup(false);
      });
    },
    [category, sort],
  );

  useEffect(() => {
    startTransition(async () => {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        setStats((await response.json()) as DashboardStats);
      }
    });
  }, []);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const items = useMemo(() => {
    const base = filterByCategory(result?.items ?? [], category);
    if (sort === "value_desc") return base;
    return sortClientSide(base, sort);
  }, [result?.items, sort, category]);

  const uniqueSetCount = useMemo(() => {
    return new Set(
      (result?.items ?? [])
        .map((copy) => copy.card?.set_name?.trim())
        .filter(Boolean),
    ).size;
  }, [result?.items]);

  const displayTotal =
    category === "all" ? (result?.total ?? 0) : items.length;

  const highlightCardNumber =
    sort === "card_number_asc" || sort === "card_number_desc";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadCollection(query.trim() || undefined, sort, category);
  }

  function handleSortChange(nextSort: SortOption) {
    setSort(nextSort);
    loadCollection(query.trim() || undefined, nextSort, category);
  }

  function handleCategoryChange(nextCategory: CollectionCategoryFilter) {
    setCategory(nextCategory);
    loadCollection(query.trim() || undefined, sort, nextCategory);
  }

  if (needsSetup) {
    return <SetupPrompt />;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player, set, or card number…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500/50"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-sky-500 px-5 py-3 font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            {isPending ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) =>
                handleSortChange(event.target.value as SortOption)
              }
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="value_desc">Value</option>
              <option value="confidence_desc">Price confidence</option>
              <option value="card_number_asc">Card #: low to high</option>
              <option value="card_number_desc">Card #: high to low</option>
              <option value="alpha_asc">Last name (A–Z)</option>
            </select>
          </label>

          <div className="ml-auto flex gap-2">
            {category !== "teams" && category !== "by_set" ? (
              <>
                <ViewToggle active={view === "grid"} onClick={() => setView("grid")} label="Grid" />
                <ViewToggle active={view === "list"} onClick={() => setView("list")} label="List" />
              </>
            ) : null}
          </div>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <>
          <SummaryBar summary={result.summary} total={displayTotal} />

          <CollectionFilterStats
            stats={stats}
            activeFilter={category}
            onFilterChange={handleCategoryChange}
            isPending={isPending}
            setCount={uniqueSetCount}
          />

          {category === "teams" ? (
            <CollectionTeamGroups items={items} />
          ) : category === "by_set" ? (
            <CollectionSetBanners items={items} />
          ) : items.length > 0 ? (
            view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((copy) => (
                  <CardTile
                    key={copy.uuid}
                    copy={copy}
                    highlightChecklist={highlightCardNumber}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((copy) => (
                  <CardListRow
                    key={copy.uuid}
                    copy={copy}
                    highlightChecklist={highlightCardNumber}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 px-6 py-16 text-center text-slate-400">
              {category === "all"
                ? "No cards found. Try a different search or sort."
                : "No cards match this filter."}
            </div>
          )}
        </>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/5] animate-pulse rounded-xl bg-slate-900"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm ${
        active
          ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
          : "border-slate-800 text-slate-400 hover:border-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
