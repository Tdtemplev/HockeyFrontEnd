"use client";

import { useEffect, useState, useTransition } from "react";

import { SetupPrompt } from "@/components/collection/SetupPrompt";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/slab/format";
import type { DashboardStats, PortfolioHistory } from "@/lib/slab/types";

export function PortfolioView() {
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/portfolio");

      if (response.status === 503) {
        setNeedsSetup(true);
        return;
      }

      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        setError(body.detail ?? "Failed to load portfolio");
        return;
      }

      const data = (await response.json()) as {
        dashboard: DashboardStats;
        history: PortfolioHistory;
      };

      setDashboard(data.dashboard);
      setHistory(data.history);
    });
  }, []);

  if (needsSetup) return <SetupPrompt />;

  const chartPoints =
    history?.points?.length ? history.points : (dashboard?.portfolio_series ?? []);

  return (
    <div className="space-y-8">
      {isPending && !dashboard ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-900" />
          ))}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Portfolio value"
              value={formatCurrency(dashboard.portfolio_value)}
            />
            <StatCard
              label="Cost basis"
              value={formatCurrency(dashboard.total_cost_basis)}
            />
            <StatCard
              label="Unrealized P&L"
              value={formatSignedCurrency(dashboard.total_unrealized_gain_loss)}
            />
            <StatCard
              label="ROI"
              value={formatPercent(dashboard.portfolio_roi)}
              hint={
                dashboard.portfolio_change_7d
                  ? `7d change ${formatSignedCurrency(dashboard.portfolio_change_7d)}`
                  : undefined
              }
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total cards" value={String(dashboard.total_cards ?? 0)} />
            <StatCard label="Autos" value={String(dashboard.autos ?? 0)} />
            <StatCard label="Rookies" value={String(dashboard.rookies ?? 0)} />
            <StatCard
              label="Priced coverage"
              value={formatPercent(dashboard.priced_coverage)}
            />
          </section>

          <PortfolioChart points={chartPoints} />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-lg font-semibold text-white">Most valuable</h2>
              <div className="mt-4 space-y-3">
                {(dashboard.most_valuable ?? []).slice(0, 8).map((card) => (
                  <div
                    key={card.uuid}
                    className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {card.subjects.join(" / ")} · {card.card_number}
                      </p>
                      <p className="text-sm text-slate-400">
                        {[card.set_name, card.finish, card.grade_key]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">
                        {formatCurrency(card.fair_market_value)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatSignedCurrency(card.unrealized_gain_loss)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-lg font-semibold text-white">Top sets</h2>
              <div className="mt-4 space-y-3">
                {(dashboard.top_sets ?? []).slice(0, 10).map((set) => (
                  <div
                    key={set.label}
                    className="flex items-center justify-between border-b border-slate-800 pb-3 last:border-0"
                  >
                    <p className="text-white">{set.label}</p>
                    <p className="text-slate-400">{set.count} cards</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
