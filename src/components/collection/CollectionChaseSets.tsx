"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { TeamLogo } from "@/components/collection/TeamLogo";
import { cardSubtitle, cardTitle, formatCurrency } from "@/lib/slab/format";
import type { CustomSetDetail, CustomSetOut } from "@/lib/slab/types";

function completionTone(pct: number): string {
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 50) return "text-sky-300";
  return "text-slate-300";
}

function ChaseSetBanner({
  set,
  expanded,
  onToggle,
}: {
  set: CustomSetOut;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left transition ${
        expanded
          ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/20"
          : "border-slate-800 bg-slate-900/60 hover:border-sky-500/30 hover:bg-slate-900"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-white">{set.name}</p>
        {set.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-400">{set.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          {set.set_type} · {set.visibility}
          {set.creator_name ? ` · by ${set.creator_name}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-5 text-sm">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Cards</p>
          <p className="font-semibold text-white">{set.card_count}</p>
        </div>
        <span className="text-xs text-sky-400">{expanded ? "Hide" : "Show"}</span>
      </div>
    </button>
  );
}

function ChaseSetDetailPanel({ setUuid }: { setUuid: string }) {
  const [detail, setDetail] = useState<CustomSetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/chase/${setUuid}`);
      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        setError(body.detail ?? "Failed to load set");
        return;
      }
      setDetail((await response.json()) as CustomSetDetail);
    });
  }, [setUuid]);

  if (isPending && !detail) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="h-24 animate-pulse rounded-lg bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!detail) return null;

  const completion = detail.completion;
  const owned = detail.cards.filter((entry) => entry.owned);
  const missing = detail.cards.filter((entry) => !entry.owned);

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      {completion ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Your completion
            </p>
            <p className={`text-3xl font-semibold ${completionTone(completion.completion_pct)}`}>
              {completion.completion_pct.toFixed(1)}%
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {completion.owned_cards} of {completion.total_cards} slots owned
            </p>
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-800 sm:w-48">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${Math.min(completion.completion_pct, 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {owned.length > 0 ? (
        <section>
          <h4 className="text-sm font-medium text-emerald-300">
            Owned ({owned.length})
          </h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {owned.map((entry) => (
              <ChaseCardEntry key={entry.uuid} entry={entry} owned />
            ))}
          </div>
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section>
          <h4 className="text-sm font-medium text-slate-400">
            Still need ({missing.length})
          </h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {missing.map((entry) => (
              <ChaseCardEntry key={entry.uuid} entry={entry} owned={false} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.cards.length === 0 ? (
        <p className="text-sm text-slate-500">
          {detail.set_type === "dynamic"
            ? "No catalog cards match this set’s filter yet."
            : "This set has no cards yet. Add some with the CLI."}
        </p>
      ) : null}
    </div>
  );
}

function ChaseCardEntry({
  entry,
  owned,
}: {
  entry: CustomSetDetail["cards"][number];
  owned: boolean;
}) {
  const card = entry.card;
  const team = card.subjects.find((subject) => subject.team?.trim())?.team;

  return (
    <Link
      href={`/cards/${card.uuid}`}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
        owned
          ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
          : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
      }`}
    >
      {team ? (
        <TeamLogo team={team} size="sm" className="mt-0.5 shrink-0" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{cardTitle(card)}</p>
        <p className="truncate text-xs text-slate-500">{cardSubtitle(card)}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
          {entry.match_mode}
          {entry.owned_printing ? ` · ${entry.owned_printing}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-sky-300">
          {formatCurrency(card.market?.fair_market_value)}
        </p>
        <p className={`text-xs ${owned ? "text-emerald-400" : "text-slate-500"}`}>
          {owned ? "Owned" : "Need"}
        </p>
      </div>
    </Link>
  );
}

function ChaseCliHelp() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="font-medium text-white">Create sets with the CLI</p>
          <p className="mt-0.5 text-sm text-slate-400">
            Example: 2025/2026 Carolina Hurricanes team chase
          </p>
        </div>
        <span className="text-sm text-sky-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-800 px-5 py-4 text-sm text-slate-300">
          <p>
            Slab calls these <strong className="text-white">chase sets</strong>. Use{" "}
            <code className="rounded bg-slate-950 px-1.5 py-0.5 text-sky-300">slab chase</code>{" "}
            commands (not <code className="rounded bg-slate-950 px-1.5 py-0.5">custom-set</code>
            ).
          </p>

          <div>
            <p className="font-medium text-white">Option A — dynamic set (recommended for a full team)</p>
            <p className="mt-1 text-slate-400">
              Auto-includes every catalog card matching your filter (team + season). Best for
              all Hurricanes players on 2025–26 cards.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{`slab chase create
# Set name: 2025/2026 Hurricane Team
# Description: Carolina Hurricanes roster chase
# Set type: dynamic
# Team: Carolina Hurricanes
# Season year: 2025`}</pre>
          </div>

          <div>
            <p className="font-medium text-white">Option B — curated set (hand-picked players)</p>
            <p className="mt-1 text-slate-400">
              You pick each player/card slot manually. Use any_printing match mode to count any
              parallel of that player&apos;s card.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{`slab chase create
# Set name: 2025/2026 Hurricane Team
# Set type: curated

slab chase add
# Pick the set, then search each player and add their card`}</pre>
          </div>

          <p className="text-xs text-slate-500">
            Note: Carolina&apos;s Stanley Cup win was 2006. For that roster, use a curated set and
            add each 2006 player, or use dynamic filters with year 2006 and team Carolina
            Hurricanes. Refresh this page after creating a set with slab chase list.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function CollectionChaseSets() {
  const [sets, setSets] = useState<CustomSetOut[]>([]);
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/chase");
      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        setError(body.detail ?? "Failed to load chase sets");
        return;
      }
      const data = (await response.json()) as { sets: CustomSetOut[] };
      setSets(data.sets);
    });
  }, []);

  if (isPending && sets.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-900" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChaseCliHelp />

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      ) : null}

      {sets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 px-6 py-16 text-center text-slate-400">
          No chase sets yet. Create one with{" "}
          <code className="text-sky-300">slab chase create</code> and it will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            {sets.length} chase set{sets.length === 1 ? "" : "s"} · completion tracked against
            your collection
          </p>
          {sets.map((set) => {
            const expanded = expandedUuid === set.uuid;
            return (
              <section key={set.uuid} className="space-y-3">
                <ChaseSetBanner
                  set={set}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedUuid((current) =>
                      current === set.uuid ? null : set.uuid,
                    )
                  }
                />
                {expanded ? <ChaseSetDetailPanel setUuid={set.uuid} /> : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
