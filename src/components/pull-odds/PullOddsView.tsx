"use client";

import { useState, useTransition } from "react";

import { SetupPrompt } from "@/components/collection/SetupPrompt";
import { BOX_FORMATS, formatBoxLabel } from "@/lib/box-formats";
import { formatBoxes, formatProbability } from "@/lib/pull-odds";
import { cardSubtitle, cardTitle, formatCurrency } from "@/lib/slab/format";
import type { BoxRecommendation } from "@/lib/box-recommendations";
import type { CardOut } from "@/lib/slab/types";

type SearchMode = "any" | "specific";
type CardTypeFilter = "all" | "auto" | "rookie" | "numbered";

export function PullOddsView() {
  const [player, setPlayer] = useState("");
  const [cardQuery, setCardQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("any");
  const [cardType, setCardType] = useState<CardTypeFilter>("all");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([
    "hobby_box",
    "blaster_box",
    "mega_box",
    "retail_box",
  ]);
  const [selectedCardUuid, setSelectedCardUuid] = useState<string | null>(null);
  const [cards, setCards] = useState<CardOut[]>([]);
  const [recommendations, setRecommendations] = useState<BoxRecommendation[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isPending, startTransition] = useTransition();

  function buildRequest() {
    return {
      subject: player.trim(),
      mode,
      cardUuid: mode === "specific" ? selectedCardUuid ?? undefined : undefined,
      q: cardQuery.trim() || undefined,
      auto: cardType === "auto" ? true : undefined,
      rookie: cardType === "rookie" ? true : undefined,
      is_numbered: cardType === "numbered" ? true : undefined,
      formats: selectedFormats.length ? selectedFormats : undefined,
    };
  }

  function toggleFormat(formatId: string) {
    setSelectedFormats((current) =>
      current.includes(formatId)
        ? current.filter((id) => id !== formatId)
        : [...current, formatId],
    );
  }

  function runSearch() {
    if (!player.trim()) {
      setError("Enter a player name first.");
      return;
    }

    if (mode === "specific" && !selectedCardUuid && !cardQuery.trim()) {
      setError("Pick a specific card or narrow with a card search.");
      return;
    }

    startTransition(async () => {
      setError(null);

      const response = await fetch("/api/pull-odds/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });

      if (response.status === 503) {
        setNeedsSetup(true);
        return;
      }

      if (!response.ok) {
        const body = (await response.json()) as { detail?: string };
        setError(body.detail ?? "Search failed");
        return;
      }

      const data = (await response.json()) as {
        cards: CardOut[];
        recommendations: BoxRecommendation[];
      };

      setCards(data.cards);
      setRecommendations(data.recommendations);

      if (mode === "specific" && !selectedCardUuid && data.cards.length === 1) {
        setSelectedCardUuid(data.cards[0].uuid);
      }
    });
  }

  if (needsSetup) {
    return <SetupPrompt />;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">
          Which box should I buy?
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Search Slab&apos;s catalog to find which sealed product gives you the
          best chance to pull a card.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-400">Player</span>
            <input
              value={player}
              onChange={(event) => setPlayer(event.target.value)}
              placeholder="Nikolaj Ehlers"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500/50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Card search (optional)</span>
            <input
              value={cardQuery}
              onChange={(event) => setCardQuery(event.target.value)}
              placeholder="Young Guns, Canvas, etc."
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500/50"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip
            active={mode === "any"}
            onClick={() => {
              setMode("any");
              setSelectedCardUuid(null);
            }}
            label="Any card of this player"
          />
          <FilterChip
            active={mode === "specific"}
            onClick={() => setMode("specific")}
            label="Specific card"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["all", "All types"],
              ["auto", "Autographs"],
              ["rookie", "Rookies"],
              ["numbered", "Numbered"],
            ] as const
          ).map(([value, label]) => (
            <FilterChip
              key={value}
              active={cardType === value}
              onClick={() => setCardType(value)}
              label={label}
            />
          ))}
        </div>

        <div className="mt-4">
          <p className="text-sm text-slate-400">Box type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BOX_FORMATS.map((format) => (
              <FilterChip
                key={format.id}
                active={selectedFormats.includes(format.id)}
                onClick={() => toggleFormat(format.id)}
                label={format.label}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={runSearch}
          disabled={isPending}
          className="mt-5 rounded-xl bg-sky-500 px-5 py-3 font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60"
        >
          {isPending ? "Searching catalog…" : "Find best boxes"}
        </button>
      </section>

      {mode === "specific" && cards.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="font-semibold text-white">Pick a specific card</h3>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {cards.slice(0, 24).map((card) => (
              <button
                key={card.uuid}
                type="button"
                onClick={() => setSelectedCardUuid(card.uuid)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selectedCardUuid === card.uuid
                    ? "border-sky-500/50 bg-sky-500/10"
                    : "border-slate-800 bg-slate-950 hover:border-slate-600"
                }`}
              >
                <p className="font-medium text-white">{cardTitle(card)}</p>
                <p className="mt-1 text-sm text-slate-400">{cardSubtitle(card)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {card.odds ? `Odds ${card.odds}` : "No catalog odds"}
                  {card.release_set_name ? ` · ${card.release_set_name}` : ""}
                </p>
              </button>
            ))}
          </div>
          {selectedCardUuid ? (
            <button
              type="button"
              onClick={runSearch}
              disabled={isPending}
              className="mt-4 rounded-xl border border-sky-500/40 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/10"
            >
              Recalculate for selected card
            </button>
          ) : null}
        </section>
      ) : null}

      {recommendations.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Best boxes ranked by hit chance
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Ranked by best single-card odds. Payback score = best (hit% × FMV) ÷
              box price — not a sum of every parallel.
            </p>
          </div>

          {recommendations.map((rec, index) => (
            <article
              key={`${rec.productUuid}-${rec.setUuid}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-sky-400">
                    #{index + 1} recommendation
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    {rec.setName}
                  </h3>
                  <p className="mt-1 text-slate-400">
                    {formatBoxLabel(rec.productFormat)}
                    {rec.packsPerBox ? ` · ${rec.packsPerBox} packs/box` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    {rec.hitChanceLabel}
                  </p>
                  <p className="text-3xl font-semibold text-emerald-400">
                    {formatProbability(rec.hitChance)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniStat label="Box price" value={formatCurrency(rec.boxCost)} />
                <MiniStat
                  label="Best odds card"
                  value={rec.bestCardLabel}
                  small
                />
                <MiniStat
                  label="Payback score"
                  value={
                    rec.roiRatio !== null
                      ? `${(rec.roiRatio * 100).toFixed(0)}% of box price`
                      : "—"
                  }
                />
                <MiniStat
                  label="Best-case EV"
                  value={formatCurrency(
                    rec.expectedValuePerBox != null
                      ? String(rec.expectedValuePerBox)
                      : null,
                  )}
                />
                <MiniStat
                  label="Break-even FMV"
                  value={formatCurrency(
                    rec.breakEvenFmv != null ? String(rec.breakEvenFmv) : null,
                  )}
                />
                <MiniStat
                  label="50% chance"
                  value={`${formatBoxes(
                    rec.hitChance > 0
                      ? Math.ceil(Math.log(0.5) / Math.log(1 - rec.hitChance))
                      : null,
                  )} boxes`}
                />
              </div>

              {rec.note ? (
                <p className="mt-3 text-sm text-slate-500">{rec.note}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {cards.length > 0 && recommendations.length === 0 && !isPending ? (
        <div className="rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400">
          Found {cards.length} matching cards, but none had catalog odds tied to a
          priced sealed product. Try a different card type filter.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
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
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
          : "border-slate-700 text-slate-300 hover:border-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function MiniStat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-medium text-white ${small ? "text-sm line-clamp-2" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
