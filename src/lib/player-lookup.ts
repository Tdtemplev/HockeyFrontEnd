import { getCardComps, getCardMarket, searchCards } from "@/lib/slab/client";
import type {
  CardOut,
  CompOut,
  PricePointOut,
} from "@/lib/slab/types";

const PAGE_SIZE = 50;
const MAX_VARIANTS = 100;
const ENRICH_BATCH = 6;
const COMP_LIMIT = 100;

export interface RawPriceSummary {
  sampleSize: number;
  compTotal: number;
  median: string | null;
  low: string | null;
  high: string | null;
  average: string | null;
  compMin: string | null;
  compMax: string | null;
  lowConfidence: boolean;
  recentComps: CompOut[];
}

export interface GradedPriceSummary {
  gradeKey: string;
  finish?: string | null;
  sampleSize: number;
  median: string | null;
  low: string | null;
  high: string | null;
  lowConfidence: boolean;
}

export interface PlayerVariant {
  card: CardOut;
  raw: RawPriceSummary | null;
  graded: GradedPriceSummary[];
}

export interface PlayerLookupRequest {
  subject: string;
  q?: string;
  auto?: boolean;
  rookie?: boolean;
  is_numbered?: boolean;
}

export interface PlayerLookupResult {
  subject: string;
  total: number;
  truncated: boolean;
  variants: PlayerVariant[];
}

function toDecimal(value: number): string {
  return value.toFixed(2);
}

function compPrices(comps: CompOut[]): number[] {
  return comps
    .map((comp) => (comp.sale_price ? Number(comp.sale_price) : NaN))
    .filter((price) => !Number.isNaN(price) && price > 0);
}

function summarizeComps(comps: CompOut[], total: number): Pick<
  RawPriceSummary,
  "compTotal" | "average" | "compMin" | "compMax" | "recentComps"
> {
  const prices = compPrices(comps);

  return {
    compTotal: total,
    average: prices.length
      ? toDecimal(prices.reduce((sum, price) => sum + price, 0) / prices.length)
      : null,
    compMin: prices.length ? toDecimal(Math.min(...prices)) : null,
    compMax: prices.length ? toDecimal(Math.max(...prices)) : null,
    recentComps: comps.slice(0, 10),
  };
}

function summarizePricePoint(point: PricePointOut): GradedPriceSummary {
  return {
    gradeKey: point.grade_key,
    finish: point.finish,
    sampleSize: point.sample_size,
    median: point.price_median ?? null,
    low: point.price_low ?? null,
    high: point.price_high ?? null,
    lowConfidence: point.low_confidence ?? false,
  };
}

function pickRawPoint(points: PricePointOut[]): PricePointOut | null {
  const raw = points.find((point) => point.grade_key === "RAW");
  if (raw) return raw;
  return points.length ? points[0] : null;
}

async function fetchAllPlayerCards(
  request: PlayerLookupRequest,
): Promise<{ cards: CardOut[]; total: number; truncated: boolean }> {
  const cards: CardOut[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total && cards.length < MAX_VARIANTS) {
    const page = await searchCards({
      subject: request.subject,
      q: request.q,
      auto: request.auto,
      rookie: request.rookie,
      is_numbered: request.is_numbered,
      limit: PAGE_SIZE,
      offset,
    });

    total = page.total;
    cards.push(...(page.items ?? []));
    offset += PAGE_SIZE;
    if (!page.items?.length) break;
  }

  return {
    cards,
    total,
    truncated: total > cards.length,
  };
}

async function enrichVariant(card: CardOut): Promise<PlayerVariant> {
  const [market, comps] = await Promise.all([
    getCardMarket(card.uuid),
    getCardComps(card.uuid, { grade_key: "RAW", limit: COMP_LIMIT }),
  ]);

  const rawPoint = pickRawPoint(market.price_points);
  const compSummary = summarizeComps(comps.comps, comps.total);

  const raw: RawPriceSummary | null = rawPoint
    ? {
        sampleSize: rawPoint.sample_size,
        median: rawPoint.price_median ?? null,
        low: rawPoint.price_low ?? compSummary.compMin,
        high: rawPoint.price_high ?? compSummary.compMax,
        lowConfidence: rawPoint.low_confidence ?? false,
        ...compSummary,
      }
    : comps.total > 0
      ? {
          sampleSize: 0,
          median: null,
          low: compSummary.compMin,
          high: compSummary.compMax,
          lowConfidence: true,
          ...compSummary,
        }
      : null;

  const graded = market.price_points
    .filter((point) => point.grade_key !== "RAW")
    .map(summarizePricePoint)
    .sort((a, b) => b.sampleSize - a.sampleSize);

  return { card, raw, graded };
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

function sortVariants(variants: PlayerVariant[]): PlayerVariant[] {
  return [...variants].sort((a, b) => {
    const setCompare = (a.card.set_name ?? "").localeCompare(
      b.card.set_name ?? "",
    );
    if (setCompare !== 0) return setCompare;

    const numberCompare = a.card.card_number.localeCompare(
      b.card.card_number,
      undefined,
      { numeric: true },
    );
    if (numberCompare !== 0) return numberCompare;

    return (a.card.finish ?? "").localeCompare(b.card.finish ?? "");
  });
}

export async function lookupPlayer(
  request: PlayerLookupRequest,
): Promise<PlayerLookupResult> {
  const subject = request.subject.trim();
  const { cards, total, truncated } = await fetchAllPlayerCards({
    ...request,
    subject,
  });

  const variants = sortVariants(
    await mapInBatches(cards, ENRICH_BATCH, enrichVariant),
  );

  return {
    subject,
    total,
    truncated,
    variants,
  };
}
