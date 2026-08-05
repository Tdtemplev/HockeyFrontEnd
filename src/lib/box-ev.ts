import { computeBoxEvFromVariants } from "@/lib/variant-probability";
import type { CardOut, SealedProductOut } from "@/lib/slab/types";

export interface BoxEvBreakdown {
  setUuid: string;
  setName: string;
  productUuid: string;
  productFormat: string;
  boxCost: number | null;
  packsPerBox: number;
  cardsPerPack: number;
  cardsPerBox: number;
  pricedVariants: number;
  avgBaseFmv: number;
  baseSlotsPerBox: number;
  baseEvPerBox: number;
  chaseEvPerBox: number;
  avgEvPerCard: number;
  totalEv: number;
  roiRatio: number | null;
  profitVsBox: number | null;
  topContributors: {
    label: string;
    fmv: number;
    perBoxProbability: number;
    evPerBox: number;
    source: string;
  }[];
}

export function computeBoxEv(
  setUuid: string,
  setName: string,
  product: SealedProductOut,
  cards: CardOut[],
): BoxEvBreakdown {
  const packsPerBox = product.packs_per_box ?? 0;
  const cardsPerPack = product.cards_per_pack ?? 0;
  const cardsPerBox = packsPerBox * cardsPerPack;

  const pool = computeBoxEvFromVariants(cards, product);

  const boxCost = product.price_median ? Number(product.price_median) : null;
  const roiRatio = boxCost && boxCost > 0 ? pool.totalEv / boxCost : null;
  const profitVsBox = boxCost !== null ? pool.totalEv - boxCost : null;

  return {
    setUuid,
    setName,
    productUuid: product.uuid,
    productFormat: product.format,
    boxCost,
    packsPerBox,
    cardsPerPack,
    cardsPerBox,
    pricedVariants: pool.pricedVariants,
    avgBaseFmv: pool.avgBaseFmv,
    baseSlotsPerBox: pool.baseSlotsPerBox,
    baseEvPerBox: pool.baseEvPerBox,
    chaseEvPerBox: pool.chaseEvPerBox,
    avgEvPerCard: pool.avgEvPerCard,
    totalEv: pool.totalEv,
    roiRatio,
    profitVsBox,
    topContributors: pool.topContributors.map((row) => ({
      label: row.label,
      fmv: row.fmv,
      perBoxProbability: row.perBoxProbability,
      evPerBox: row.evPerBox,
      source: row.source,
    })),
  };
}

export async function fetchReleaseCards(
  setUuid: string,
  searchCards: (
    query: import("@/lib/slab/types").CardSearchQuery,
  ) => Promise<import("@/lib/slab/types").CardSearchResult>,
): Promise<CardOut[]> {
  const cards: CardOut[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total && cards.length < 800) {
    const page = await searchCards({
      release: [setUuid],
      include_market: true,
      limit: 100,
      offset,
    });

    total = page.total;
    cards.push(...(page.items ?? []));
    offset += 100;
    if (!page.items?.length) break;
  }

  return cards;
}
