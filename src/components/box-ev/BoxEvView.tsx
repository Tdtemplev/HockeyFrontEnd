"use client";

import { useEffect, useState, useTransition } from "react";

import { SetupPrompt } from "@/components/collection/SetupPrompt";
import { formatBoxLabel } from "@/lib/box-formats";
import type { BoxEvBreakdown } from "@/lib/box-ev";
import type { RankedBoxEv } from "@/lib/box-ev-rank";
import { formatCurrency, formatSignedCurrency } from "@/lib/slab/format";
import { formatProbability } from "@/lib/pull-odds";

export function BoxEvView() {
  const [rankings, setRankings] = useState<RankedBoxEv[]>([]);
  const [meta, setMeta] = useState<{ setsScanned: number; productsScanned: number } | null>(
    null,
  );
  const [selected, setSelected] = useState<BoxEvBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/box-ev?limit=50");

      if (response.status === 503) {
        setNeedsSetup(true);
        return;
      }

      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        setError(body.detail ?? "Failed to rank boxes");
        return;
      }

      const data = (await response.json()) as {
        rankings: RankedBoxEv[];
        setsScanned: number;
        productsScanned: number;
      };

      setRankings(data.rankings);
      setMeta({ setsScanned: data.setsScanned, productsScanned: data.productsScanned });
      setSelected(data.rankings[0] ?? null);
    });
  }, []);

  if (needsSetup) return <SetupPrompt />;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Which box to buy next</h2>
        <p className="mt-1 text-sm text-slate-400">
          Every sealed product in Slab with a box price, ranked by expected return.
          Uses median commons comps (capped), catalog odds, and print runs.
          Most boxes should show under 100% return — that&apos;s normal for sealed wax.
        </p>
        {meta ? (
          <p className="mt-2 text-xs text-slate-500">
            Scanned {meta.productsScanned} products across {meta.setsScanned} sets.
          </p>
        ) : null}
      </section>

      {isPending && rankings.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-900" />
          ))}
        </div>
      ) : null}

      {rankings.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="font-semibold text-white">All boxes ranked by return %</h3>
          <div className="mt-4 space-y-2">
            {rankings.map((row, index) => {
              const active = selected?.productUuid === row.productUuid;
              const returnPct =
                row.roiRatio !== null ? Math.round(row.roiRatio * 100) : null;

              return (
                <button
                  key={row.productUuid}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-sky-500/50 bg-sky-500/10"
                      : "border-slate-800 bg-slate-950 hover:border-slate-600"
                  }`}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wider text-sky-400">
                      #{index + 1}
                    </p>
                    <p className="font-medium text-white">{row.setName}</p>
                    <p className="text-sm text-slate-400">
                      {formatBoxLabel(row.productFormat)} · {row.cardsPerBox} cards
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        returnPct !== null && returnPct >= 100
                          ? "text-emerald-400"
                          : "text-slate-200"
                      }`}
                    >
                      {returnPct !== null ? `${returnPct}% return` : "—"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {formatCurrency(String(row.totalEv))} EV ·{" "}
                      {formatCurrency(String(row.boxCost ?? ""))} box
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {selected ? (
        <>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-xl font-semibold text-white">{selected.setName}</h3>
            <p className="mt-1 text-slate-400">
              {formatBoxLabel(selected.productFormat)} · {selected.cardsPerBox} cards/box
              ({selected.packsPerBox} packs × {selected.cardsPerPack} cards)
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Box price" value={formatCurrency(String(selected.boxCost ?? ""))} />
              <Metric
                label="Typical base common"
                value={formatCurrency(String(selected.avgBaseFmv))}
                hint={`${selected.baseSlotsPerBox} base slots`}
              />
              <Metric
                label="Total box EV"
                value={formatCurrency(String(selected.totalEv))}
                highlight
              />
              <Metric
                label="Return %"
                value={
                  selected.roiRatio !== null
                    ? `${(selected.roiRatio * 100).toFixed(0)}%`
                    : "—"
                }
                hint="100% = break even on average"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Metric
                label="Base EV"
                value={formatCurrency(String(selected.baseEvPerBox))}
              />
              <Metric
                label="Chase EV"
                value={formatCurrency(String(selected.chaseEvPerBox))}
                hint="Inserts + numbered"
              />
              <Metric
                label="Expected vs box"
                value={formatSignedCurrency(String(selected.profitVsBox ?? ""))}
              />
            </div>
          </section>

          {selected.topContributors.length > 0 ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-white">Breakdown</h3>
              <div className="mt-3 space-y-2">
                {selected.topContributors.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm"
                  >
                    <span className="text-white">{row.label}</span>
                    <span className="text-slate-400">
                      {row.source === "odds"
                        ? `${formatProbability(row.perBoxProbability)} hit/box × `
                        : ""}
                      {formatCurrency(String(row.fmv))} →{" "}
                      <span className="text-emerald-400">
                        {formatCurrency(String(row.evPerBox))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
