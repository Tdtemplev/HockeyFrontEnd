import { NextRequest, NextResponse } from "next/server";

import { searchSets, SlabApiError } from "@/lib/slab/client";
import type { SetSearchQuery } from "@/lib/slab/types";

function handleError(error: unknown) {
  if (error instanceof SlabApiError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Request failed";
  const status = message.includes("SLAB_API_KEY") ? 503 : 500;
  return NextResponse.json({ detail: message }, { status });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;

  try {
    const result = await searchSets({ q, limit: 20 });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SetSearchQuery;
    const result = await searchSets(body);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
