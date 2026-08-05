import { fetchReleaseCards } from "@/lib/box-ev";
import { cardTitle } from "@/lib/slab/format";
import {
  perBoxHitChance,
  perBoxHitProbability,
} from "@/lib/variant-probability";
import { matchesBoxFormats } from "@/lib/box-formats";
import { getSetSealed, searchCards, searchSets } from "@/lib/slab/client";
import type { CardOut, SealedProductOut } from "@/lib/slab/types";

export interface BoxRecommendRequest {
  subject: string;
  mode?: "any" | "specific";
  cardUuid?: string;
  auto?: boolean;
  rookie?: boolean;
  relic?: boolean;
  is_numbered?: boolean;
  subset?: string;
  q?: string;
  formats?: string[];
}

export interface BoxRecommendation {
  setUuid: string;
  setName: string;
  setSlug: string;
  productUuid: string;
  productFormat: string;
  boxCost: string | null;
  packsPerBox: number | null;
  hitChance: number;
  hitChanceLabel: string;
  bestCardLabel: string;
  matchingCards: number;
  cardsWithOdds: number;
  topFmv: string | null;
  expectedValuePerBox: number | null;
  roiRatio: number | null;
  breakEvenFmv: number | null;
  note?: string;
}

const MAX_SETS = 30;
const CARD_PAGE_SIZE = 100;

async function fetchMatchingCards(
  request: BoxRecommendRequest,
): Promise<CardOut[]> {
  const cards: CardOut[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total && cards.length < 300) {
    const page = await searchCards({
      subject: request.subject,
      q: request.q,
      auto: request.auto,
      rookie: request.rookie,
      relic: request.relic,
      is_numbered: request.is_numbered,
      subset: request.subset ? [request.subset] : undefined,
      include_market: true,
      limit: CARD_PAGE_SIZE,
      offset,
    });

    total = page.total;
    cards.push(...(page.items ?? []));
    offset += CARD_PAGE_SIZE;

    if (!page.items?.length) break;
  }

  if (request.mode === "specific" && request.cardUuid) {
    return cards.filter((card) => card.uuid === request.cardUuid);
  }

  return cards;
}

function productKey(card: CardOut): { slug: string; name: string } {
  return {
    slug: card.release_set_slug ?? card.set_slug ?? "unknown",
    name:
      card.release_set_name ??
      card.set_name ??
      card.release_set_slug ??
      card.set_slug ??
      "Unknown set",
  };
}

async function resolveSetUuid(slug: string, name: string): Promise<string | null> {
  const result = await searchSets({ q: name, limit: 20 });
  const items = result.items ?? [];
  const exact =
    items.find((set) => set.slug === slug) ??
    items.find((set) => set.name === name) ??
    items[0];
  return exact?.uuid ?? null;
}

export async function recommendBoxes(
  request: BoxRecommendRequest,
): Promise<{
  cards: CardOut[];
  recommendations: BoxRecommendation[];
}> {
  const cards = await fetchMatchingCards(request);

  const grouped = new Map<string, { slug: string; name: string; cards: CardOut[] }>();
  for (const card of cards) {
    const key = productKey(card);
    const existing = grouped.get(key.slug);
    if (existing) {
      existing.cards.push(card);
    } else {
      grouped.set(key.slug, { ...key, cards: [card] });
    }
  }

  const sortedGroups = [...grouped.values()]
    .sort((a, b) => b.cards.length - a.cards.length)
    .slice(0, MAX_SETS);

  const recommendations: BoxRecommendation[] = [];

  for (const group of sortedGroups) {
    const setUuid = await resolveSetUuid(group.slug, group.name);
    if (!setUuid) continue;

    let products: SealedProductOut[];
    let releaseCards: CardOut[];
    try {
      products = await getSetSealed(setUuid);
      releaseCards = await fetchReleaseCards(setUuid, searchCards);
    } catch {
      continue;
    }

    for (const product of products) {
      if (!matchesBoxFormats(product.format, request.formats)) continue;
      if (!product.packs_per_box || !product.cards_per_pack) continue;

      const perBoxValues: {
        card: CardOut;
        perBox: number;
        fmv: number;
        ev: number;
      }[] = [];

      for (const card of group.cards) {
        const perBox =
          perBoxHitProbability(card, product) ??
          (() => {
            const copies = perBoxHitChance(card, product, releaseCards);
            const cpb =
              (product.packs_per_box ?? 0) * (product.cards_per_pack ?? 0);
            return copies !== null && cpb > 0 ? copies / cpb : null;
          })();

        const fmv = card.market?.fair_market_value
          ? Number(card.market.fair_market_value)
          : 0;

        if (perBox !== null && perBox > 0 && fmv > 0) {
          perBoxValues.push({
            card,
            perBox,
            fmv,
            ev: perBox * fmv,
          });
        }
      }

      if (perBoxValues.length === 0) continue;

      const specificEntry =
        request.mode === "specific" && request.cardUuid
          ? perBoxValues.find((entry) => entry.card.uuid === request.cardUuid)
          : null;

      const hitChance =
        specificEntry?.perBox ??
        (request.mode === "specific"
          ? perBoxValues[0]?.perBox ?? 0
          : Math.max(...perBoxValues.map((entry) => entry.perBox)));

      const hitChanceLabel =
        request.mode === "specific"
          ? "Per-box hit chance (this card)"
          : "Best per-box hit chance";

      const best = perBoxValues.reduce((top, entry) =>
        entry.ev > top.ev ? entry : top,
      );

      const topFmv = group.cards
        .map((card) => card.market?.fair_market_value)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a))[0] ?? null;

      const bestEv = best.ev;
      const boxCostNum = product.price_median ? Number(product.price_median) : null;
      const roiRatio =
        bestEv !== null && boxCostNum && boxCostNum > 0 ? bestEv / boxCostNum : null;

      const breakEvenFmv =
        best.perBox > 0 && boxCostNum ? boxCostNum / best.perBox : null;

      recommendations.push({
        setUuid,
        setName: group.name,
        setSlug: group.slug,
        productUuid: product.uuid,
        productFormat: product.format,
        boxCost: product.price_median ?? null,
        packsPerBox: product.packs_per_box ?? null,
        hitChance,
        hitChanceLabel,
        bestCardLabel: cardTitle(best.card),
        matchingCards: group.cards.length,
        cardsWithOdds: perBoxValues.length,
        topFmv,
        expectedValuePerBox: bestEv,
        roiRatio,
        breakEvenFmv,
        note:
          request.mode === "any"
            ? `${perBoxValues.length} matching variants priced — odds use print runs + catalog odds for ${product.format.replaceAll("_", " ")}.`
            : undefined,
      });
    }
  }

  recommendations.sort((a, b) => {
    if (b.hitChance !== a.hitChance) return b.hitChance - a.hitChance;
    const costA = a.boxCost ? Number(a.boxCost) : Infinity;
    const costB = b.boxCost ? Number(b.boxCost) : Infinity;
    return costA - costB;
  });

  return { cards, recommendations };
}
