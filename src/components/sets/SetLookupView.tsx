"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { SetupPrompt } from "@/components/collection/SetupPrompt";
import { SetsCatalogTable } from "@/components/sets/SetsCatalogTable";
import { setSearchText } from "@/lib/set-label";
import {
  diffNewSets,
  loadSetsSnapshot,
} from "@/lib/slab-news-snapshot";
import type { SetOut } from "@/lib/slab/types";

export function SetLookupView() {
  const [sets, setSets] = useState<SetOut[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);

      const response = await fetch("/api/sets");

      if (response.status === 503) {
        setNeedsSetup(true);
        return;
      }

      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        setError(body.detail ?? "Failed to load sets");
        return;
      }

      const data = (await response.json()) as { sets: SetOut[] };
      setSets(data.sets);
    });
  }, []);

  const filteredSets = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sets;

    return sets.filter((set) => setSearchText(set).includes(trimmed));
  }, [sets, query]);

  const newSetUuids = useMemo(() => {
    const snapshot = loadSetsSnapshot();
    if (!snapshot) return new Set<string>();
    return new Set(diffNewSets(sets, snapshot).map((set) => set.uuid));
  }, [sets]);

  if (needsSetup) return <SetupPrompt />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-400">
          Browse every set loaded in Slab. Search by name, brand, season, year, or sport.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sets…"
          className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
        />
        <span className="text-sm text-slate-400">
          {filteredSets.length} of {sets.length} sets
        </span>
      </div>

      {isPending && !sets.length ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-900" />
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <SetsCatalogTable sets={filteredSets} newSetUuids={newSetUuids} />
        </section>
      )}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
