import { computeBoxEv, fetchReleaseCards } from "@/lib/box-ev";
import { getSetSealed, searchCards, searchSets } from "@/lib/slab/client";
import type { BoxEvBreakdown } from "@/lib/box-ev";
import type { SealedProductOut, SetOut } from "@/lib/slab/types";

const RANKABLE_FORMATS = new Set([
  "hobby_box",
  "blaster_box",
  "retail_box",
  "mega_box",
  "tin",
  "hanger",
  "starter",
]);

function isRankableProduct(product: SealedProductOut): boolean {
  return (
    RANKABLE_FORMATS.has(product.format) &&
    Boolean(product.packs_per_box) &&
    Boolean(product.cards_per_pack) &&
    Boolean(product.price_median) &&
    Number(product.price_median) > 0
  );
}

async function fetchAllSets(): Promise<SetOut[]> {
  const sets: SetOut[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await searchSets({ limit: 50, offset });
    total = page.total;
    sets.push(...(page.items ?? []));
    offset += 50;
    if (!page.items?.length) break;
  }

  return sets;
}

export interface RankedBoxEv extends BoxEvBreakdown {
  label: string;
}

export async function rankAllBoxProducts(
  limit = 40,
): Promise<{ rankings: RankedBoxEv[]; setsScanned: number; productsScanned: number }> {
  const sets = await fetchAllSets();
  const cardCache = new Map<string, Awaited<ReturnType<typeof fetchReleaseCards>>>();
  const rankings: RankedBoxEv[] = [];
  let productsScanned = 0;

  for (const set of sets) {
    if ((set.priced_count ?? 0) < 10) continue;

    let products: SealedProductOut[];
    try {
      products = await getSetSealed(set.uuid);
    } catch {
      continue;
    }

    const rankable = products.filter(isRankableProduct);
    if (rankable.length === 0) continue;

    let cards = cardCache.get(set.uuid);
    if (!cards) {
      cards = await fetchReleaseCards(set.uuid, searchCards);
      cardCache.set(set.uuid, cards);
    }

    for (const product of rankable) {
      productsScanned += 1;
      const breakdown = computeBoxEv(
        set.uuid,
        set.name ?? product.set_name ?? set.slug,
        product,
        cards,
      );

      if (breakdown.totalEv <= 0) continue;

      rankings.push({
        ...breakdown,
        label: `${set.name ?? set.slug} · ${product.format.replaceAll("_", " ")}`,
      });
    }
  }

  rankings.sort((a, b) => {
    const roiA = a.roiRatio ?? -Infinity;
    const roiB = b.roiRatio ?? -Infinity;
    if (roiB !== roiA) return roiB - roiA;
    return (b.totalEv ?? 0) - (a.totalEv ?? 0);
  });

  return {
    rankings: rankings.slice(0, limit),
    setsScanned: sets.length,
    productsScanned,
  };
}
