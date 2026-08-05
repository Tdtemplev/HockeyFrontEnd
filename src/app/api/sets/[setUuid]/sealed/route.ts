import { NextRequest, NextResponse } from "next/server";

import { getSetSealed, SlabApiError } from "@/lib/slab/client";

function handleError(error: unknown) {
  if (error instanceof SlabApiError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Request failed";
  const status = message.includes("SLAB_API_KEY") ? 503 : 500;
  return NextResponse.json({ detail: message }, { status });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ setUuid: string }> },
) {
  try {
    const { setUuid } = await context.params;
    const products = await getSetSealed(setUuid);
    return NextResponse.json(products);
  } catch (error) {
    return handleError(error);
  }
}
