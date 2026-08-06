import type { CardPricePoint } from "@/lib/slab/types";
import { formatCurrency } from "@/lib/slab/format";

interface CardPriceChartProps {
  points: CardPricePoint[];
  gradeKey: string;
}

function chartPadding(min: number, max: number): number {
  const span = max - min;
  if (span <= 0) {
    return Math.max(min * 0.08, min >= 100 ? 5 : min >= 10 ? 1 : 0.25);
  }
  return span * 0.12;
}

export function CardPriceChart({ points, gradeKey }: CardPriceChartProps) {
  if (points.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">
        Not enough price history yet for {gradeKey}.
      </div>
    );
  }

  const medians = points.map((point) => Number(point.price_median));
  const medianMin = Math.min(...medians);
  const medianMax = Math.max(...medians);
  const padding = chartPadding(medianMin, medianMax);
  const scaleMin = Math.max(0, medianMin - padding);
  const scaleMax = medianMax + padding;
  const range = scaleMax - scaleMin || 1;

  const width = 800;
  const height = 220;
  const padLeft = 72;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 28;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  function toY(value: number): number {
    return padTop + plotHeight - ((value - scaleMin) / range) * plotHeight;
  }

  function toX(index: number): number {
    return padLeft + (index / (points.length - 1)) * plotWidth;
  }

  const medianPath = medians
    .map((value, index) => {
      const x = toX(index);
      const y = toY(value);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const bandPoints = points
    .map((point, index) => {
      const low = point.price_low ? Number(point.price_low) : Number(point.price_median);
      const high = point.price_high ? Number(point.price_high) : Number(point.price_median);
      return { x: toX(index), low: toY(low), high: toY(high) };
    })
    .filter((point) => point.low !== point.high);

  const bandPath =
    bandPoints.length > 0
      ? [
          ...bandPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.high}`),
          ...[...bandPoints].reverse().map((point) => `L${point.x},${point.low}`),
          "Z",
        ].join(" ")
      : null;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const value = scaleMin + range * fraction;
    const y = toY(value);
    return { value, y };
  });

  const periodLow = Math.min(...medians);
  const periodHigh = Math.max(...medians);
  const periodChange = medians.at(-1)! - medians[0]!;
  const changePct =
    medians[0] !== 0 ? ((periodChange / medians[0]) * 100).toFixed(1) : null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <span className="h-0.5 w-6 bg-sky-400" />
          FMV ({gradeKey})
        </span>
        <span className="text-slate-500">
          Period {formatCurrency(String(periodLow))} – {formatCurrency(String(periodHigh))}
          {changePct !== null ? (
            <span
              className={
                periodChange > 0
                  ? "ml-2 text-emerald-400"
                  : periodChange < 0
                    ? "ml-2 text-rose-400"
                    : "ml-2 text-slate-400"
              }
            >
              {periodChange > 0 ? "+" : ""}
              {changePct}%
            </span>
          ) : null}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        {gridLines.map(({ value, y }) => (
          <g key={value}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={y + 4}
              textAnchor="end"
              fill="#64748b"
              fontSize="11"
            >
              {formatCurrency(String(value))}
            </text>
          </g>
        ))}
        {bandPath ? (
          <path d={bandPath} fill="rgba(56, 189, 248, 0.12)" stroke="none" />
        ) : null}
        <path d={medianPath} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
        {medians.map((value, index) => (
          <circle
            key={points[index]?.date ?? index}
            cx={toX(index)}
            cy={toY(value)}
            r="3"
            fill="#38bdf8"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{points[0]?.date}</span>
        <span>{formatCurrency(String(medians.at(-1)))} latest</span>
        <span>{points.at(-1)?.date}</span>
      </div>
    </div>
  );
}
