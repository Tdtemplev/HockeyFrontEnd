import { perBoxFromPacks, selectOddsForProduct } from "@/lib/pull-odds";
import type { CardOut, SealedProductOut } from "@/lib/slab/types";

export interface VariantContribution {
  uuid: string;
  label: string;
  fmv: number;
  perBoxProbability: number;
  evPerBox: number;
  source: "print_run" | "odds" | "base";
}

function fmv(card: CardOut): number {
  return card.market?.fair_market_value
    ? Number(card.market.fair_market_value)
    : 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

function variantLabel(card: CardOut): string {
  const player = card.subjects.map((subject) => subject.name).join(" / ");
  const parts = [player, card.card_number];
  if (card.finish) parts.push(card.finish);
  if (card.subset && card.subset !== "Base Set") parts.push(card.subset);
  return parts.filter(Boolean).join(" · ");
}

function insertKey(card: CardOut): string {
  return `${card.card_number}|${card.subset ?? ""}|${card.subjects.map((s) => s.name).join("/")}`;
}

function isBaseCard(card: CardOut): boolean {
  return (
    !card.odds &&
    !card.print_run &&
    !card.finish &&
    (!card.subset || card.subset === "Base Set")
  );
}

function cardsPerBox(product: SealedProductOut): number {
  return (product.packs_per_box ?? 0) * (product.cards_per_pack ?? 0);
}

function perBoxProbability(card: CardOut, product: SealedProductOut): number | null {
  if (card.odds) {
    const parsed = selectOddsForProduct(card.odds, product);
    if (parsed.perPack && product.packs_per_box) {
      return perBoxFromPacks(parsed.perPack, product.packs_per_box);
    }
    if (parsed.perBox !== null) return parsed.perBox;
  }
  return null;
}

/**
 * Conservative box EV:
 * - Base: median base-set FMV × base card slots (most of the box)
 * - Inserts: expected insert cards/box × odds-weighted avg insert FMV
 * - Numbered: small share of boxes × print-run-weighted parallel FMV
 *
 * Most boxes should land below box price — that's normal for sealed product.
 */
export function computeBoxEvFromVariants(
  cards: CardOut[],
  product: SealedProductOut,
): {
  avgEvPerCard: number;
  totalEv: number;
  baseEvPerBox: number;
  chaseEvPerBox: number;
  avgBaseFmv: number;
  baseSlotsPerBox: number;
  topContributors: VariantContribution[];
  pricedVariants: number;
} {
  const cpb = cardsPerBox(product);
  const packsPerBox = product.packs_per_box ?? 0;

  const priced = cards.filter((card) => fmv(card) > 0);
  const baseCards = priced.filter(isBaseCard);
  const baseFmvs = baseCards.map(fmv);
  const commonsFmvs = baseFmvs.filter((value) => value <= 1.5);
  const rawTypical =
    commonsFmvs.length >= 15
      ? percentile(commonsFmvs, 0.5)
      : percentile(baseFmvs, 0.1);
  // Slab comps skew toward cards people sell — cap bulk base near actual common value.
  const typicalBaseFmv = Math.min(rawTypical, 0.45);

  const chaseGroups = new Map<
    string,
    { card: CardOut; perPack: number }
  >();

  for (const card of priced) {
    if (!card.odds) continue;
    const parsed = selectOddsForProduct(card.odds, product);
    const perPack = parsed.perPack;
    if (!perPack || perPack <= 0) continue;
    const key = insertKey(card);
    const existing = chaseGroups.get(key);
    if (!existing || fmv(card) > fmv(existing.card)) {
      chaseGroups.set(key, { card, perPack });
    }
  }

  const oddsInserts = [...chaseGroups.values()];
  const chaseContributions: VariantContribution[] = [];

  // ~0.75 insert cards per pack (conservative — not every pack has a hit).
  const insertCardsPerBox = Math.min(
    cpb,
    Math.max(1, Math.round(packsPerBox * 0.75)),
  );
  const baseSlotsPerBox = Math.max(0, cpb - insertCardsPerBox);

  let insertEvPerBox = 0;
  if (oddsInserts.length > 0 && packsPerBox > 0) {
    const totalPerPack = oddsInserts.reduce((sum, row) => sum + row.perPack, 0);
    // Use common inserts (1:24 or better) for avg value — rare chases barely move EV.
    const commonInserts = oddsInserts.filter((row) => row.perPack >= 1 / 24);
    const insertPool = commonInserts.length > 0 ? commonInserts : oddsInserts;
    const rawInsertFmv =
      insertPool.reduce((sum, row) => sum + row.perPack * fmv(row.card), 0) /
      Math.max(
        insertPool.reduce((sum, row) => sum + row.perPack, 0),
        1,
      );
    const weightedInsertFmv = Math.min(rawInsertFmv, 2);

    insertEvPerBox = insertCardsPerBox * weightedInsertFmv;

    for (const { card, perPack } of oddsInserts
      .sort((a, b) => b.perPack * fmv(b.card) - a.perPack * fmv(a.card))
      .slice(0, 5)) {
      const perBox = perBoxFromPacks(perPack, packsPerBox);
      const share = perPack / Math.max(totalPerPack, 1);
      chaseContributions.push({
        uuid: card.uuid,
        label: variantLabel(card),
        fmv: fmv(card),
        perBoxProbability: perBox,
        evPerBox: share * insertEvPerBox,
        source: "odds",
      });
    }
  }

  const numbered = priced.filter(
    (card) => card.print_run && card.print_run > 0 && !card.odds,
  );
  const totalPrintRun = numbered.reduce(
    (sum, card) => sum + (card.print_run ?? 0),
    0,
  );

  let numberedEvPerBox = 0;
  if (totalPrintRun > 0) {
    // ~1.5% of boxes contain a numbered parallel — not one of every variant.
    const numberedBoxRate = 0.015;
    const weightedNumberedFmv =
      numbered.reduce(
        (sum, card) => sum + ((card.print_run ?? 0) / totalPrintRun) * fmv(card),
        0,
      );
    numberedEvPerBox = numberedBoxRate * weightedNumberedFmv;

    const topNumbered = [...numbered]
      .sort(
        (a, b) =>
          ((b.print_run ?? 0) / totalPrintRun) * fmv(b) -
          ((a.print_run ?? 0) / totalPrintRun) * fmv(a),
      )
      .slice(0, 3);

    for (const card of topNumbered) {
      const share = (card.print_run ?? 0) / totalPrintRun;
      chaseContributions.push({
        uuid: card.uuid,
        label: variantLabel(card),
        fmv: fmv(card),
        perBoxProbability: share * numberedBoxRate,
        evPerBox: share * numberedEvPerBox,
        source: "print_run",
      });
    }
  }

  const baseEvPerBox = baseSlotsPerBox * typicalBaseFmv;
  const chaseEvPerBox = insertEvPerBox + numberedEvPerBox;
  const totalEv = baseEvPerBox + chaseEvPerBox;
  const avgEvPerCard = cpb > 0 ? totalEv / cpb : 0;

  const topContributors = [
    ...chaseContributions,
    {
      uuid: "base-pool",
      label: `Base commons (${commonsFmvs.length} under $1.50)`,
      fmv: typicalBaseFmv,
      perBoxProbability: baseSlotsPerBox / Math.max(cpb, 1),
      evPerBox: baseEvPerBox,
      source: "base" as const,
    },
  ]
    .sort((a, b) => b.evPerBox - a.evPerBox)
    .slice(0, 10);

  return {
    avgEvPerCard,
    totalEv,
    baseEvPerBox,
    chaseEvPerBox,
    avgBaseFmv: typicalBaseFmv,
    baseSlotsPerBox,
    topContributors,
    pricedVariants: priced.length,
  };
}

export function perBoxHitProbability(
  card: CardOut,
  product: SealedProductOut,
): number | null {
  return perBoxProbability(card, product);
}

export function perBoxHitChance(
  card: CardOut,
  product: SealedProductOut,
  allCards: CardOut[],
): number | null {
  const cpb = cardsPerBox(product);
  const prob = perBoxHitProbability(card, product);
  if (prob !== null) return prob * cpb;

  const numbered = allCards.filter((c) => c.print_run && c.print_run > 0 && fmv(c) > 0);
  const totalPrintRun = numbered.reduce((sum, c) => sum + (c.print_run ?? 0), 0);
  if (card.print_run && totalPrintRun > 0) {
    return (card.print_run / totalPrintRun) * cpb * 0.015;
  }

  return null;
}
