import { NextRequest, NextResponse } from "next/server";

import { computeBoxEv, fetchReleaseCards } from "@/lib/box-ev";
import { rankAllBoxProducts } from "@/lib/box-ev-rank";
import { getSetSealed, searchCards, searchSets, SlabApiError } from "@/lib/slab/client";

function handleError(error: unknown) {
  if (error instanceof SlabApiError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  const status = message.includes("SLAB_API_KEY") ? 503 : 500;
  return NextResponse.json({ detail: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 40);
    const result = await rankAllBoxProducts(limit);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      setUuid?: string;
      productUuid?: string;
      setQuery?: string;
    };

    let setUuid = body.setUuid;
    let setName = "Unknown set";

    if (!setUuid && body.setQuery) {
      const sets = await searchSets({ q: body.setQuery, limit: 5 });
      const match = sets.items?.[0];
      if (!match) {
        return NextResponse.json({ detail: "No set found." }, { status: 404 });
      }
      setUuid = match.uuid;
      setName = match.name ?? match.slug;
    }

    if (!setUuid) {
      return NextResponse.json({ detail: "setUuid or setQuery required." }, { status: 400 });
    }

    const products = await getSetSealed(setUuid);
    if (products.length === 0) {
      return NextResponse.json({ detail: "No sealed products for this set." }, { status: 404 });
    }

    const product =
      products.find((entry) => entry.uuid === body.productUuid) ?? products[0];

    setName = product.set_name ?? setName;
    const cards = await fetchReleaseCards(setUuid, searchCards);
    const breakdown = computeBoxEv(setUuid, setName, product, cards);

    const allProducts = products
      .filter((entry) => entry.packs_per_box && entry.cards_per_pack)
      .map((entry) => computeBoxEv(setUuid!, setName, entry, cards))
      .sort((a, b) => (b.roiRatio ?? 0) - (a.roiRatio ?? 0));

    return NextResponse.json({ breakdown, allProducts, cardsSampled: cards.length });
  } catch (error) {
    return handleError(error);
  }
}
