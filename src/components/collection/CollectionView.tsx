"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { CardListRow } from "@/components/collection/CardListRow";
import { CardTile } from "@/components/collection/CardTile";
import { CollectionDuplicateGroups } from "@/components/collection/CollectionDuplicateGroups";
import { CollectionFilterStats } from "@/components/collection/CollectionFilterStats";
import { CollectionSetBanners } from "@/components/collection/CollectionSetBanners";
import { CollectionTeamGroups } from "@/components/collection/CollectionTeamGroups";
import { SetupPrompt } from "@/components/collection/SetupPrompt";
import { SummaryBar } from "@/components/collection/SummaryBar";
import { formatApiDetail } from "@/lib/api-errors";
import {
  categoryQueryParams,
  countDuplicateCards,
  filterByCategory,
  ownedCountByCardUuid,
  type CollectionCategoryFilter,
} from "@/lib/collection-filters";
import {
  sortCollectionCopies,
  type CollectionSortOption,
} from "@/lib/collection-sort";
import type { CardCopyOut, CollectionResult, DashboardStats } from "@/lib/slab/types";

type ViewMode = "grid" | "list";

export function CollectionView() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CollectionSortOption>("value_desc");
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
      nextCategory?: CollectionCategoryFilter,
    ) => {
      startTransition(async () => {
        setError(null);

        const activeCategory = nextCategory ?? category;
        const params = new URLSearchParams();
        params.set("all", "true");
        if (search) params.set("q", search);

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
    [category],
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
    return sortCollectionCopies(base, sort);
  }, [result?.items, sort, category]);

  const uniqueSetCount = useMemo(() => {
    return new Set(
      (result?.items ?? [])
        .map((copy) => copy.card?.set_name?.trim())
        .filter(Boolean),
    ).size;
  }, [result?.items]);

  const duplicateCount = useMemo(
    () => countDuplicateCards(result?.items ?? []),
    [result?.items],
  );

  const ownedTotals = useMemo(
    () => ownedCountByCardUuid(result?.items ?? []),
    [result?.items],
  );

  const displayTotal =
    category === "all"
      ? (result?.total ?? 0)
      : category === "duplicates"
        ? duplicateCount
        : items.length;

  const highlightCardNumber =
    sort === "card_number_asc" || sort === "card_number_desc";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadCollection(query.trim() || undefined, category);
  }

  function handleSortChange(nextSort: CollectionSortOption) {
    setSort(nextSort);
  }

  function handleCategoryChange(nextCategory: CollectionCategoryFilter) {
    setCategory(nextCategory);
    loadCollection(query.trim() || undefined, nextCategory);
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
                handleSortChange(event.target.value as CollectionSortOption)
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
            {category !== "teams" &&
            category !== "by_set" &&
            category !== "duplicates" ? (
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
            duplicateCount={duplicateCount}
          />

          {category === "teams" ? (
            <CollectionTeamGroups items={items} />
          ) : category === "by_set" ? (
            <CollectionSetBanners items={items} />
          ) : category === "duplicates" ? (
            <CollectionDuplicateGroups items={result?.items ?? []} />
          ) : items.length > 0 ? (
            view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((copy) => (
                  <CardTile
                    key={copy.uuid}
                    copy={copy}
                    highlightChecklist={highlightCardNumber}
                    ownedTotal={ownedTotals.get(copy.card_uuid)}
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
                    ownedTotal={ownedTotals.get(copy.card_uuid)}
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
