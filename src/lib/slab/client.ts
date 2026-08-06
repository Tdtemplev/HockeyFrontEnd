import { requireSlabConfig } from "./config";
import type {
  CardComps,
  CardMarket,
  CardCopyOut,
  CardOut,
  CardPriceHistory,
  CardSearchQuery,
  CardSearchResult,
  CollectionResult,
  CollectionSearchQuery,
  DashboardStats,
  MeOut,
  PortfolioHistory,
  SealedProductOut,
  SetSearchQuery,
  SetSearchResult,
  SlabError,
} from "./types";

class SlabApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function slabFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { apiKey, apiUrl } = requireSlabConfig();

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as SlabError;
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new SlabApiError(detail, response.status);
  }

  return response.json() as Promise<T>;
}

let cachedCollectorUuid: string | null = null;

export async function getCollectorUuid(): Promise<string> {
  const { collectorUuid } = requireSlabConfig();
  if (collectorUuid) return collectorUuid;

  if (cachedCollectorUuid) return cachedCollectorUuid;

  const account = await getAccount();
  const uuid =
    account.default_collector_uuid ?? account.collectors[0]?.uuid ?? null;

  if (!uuid) {
    throw new Error(
      "No collector found for this API key. Create one with `slab collector create` or set SLAB_COLLECTOR_UUID.",
    );
  }

  cachedCollectorUuid = uuid;
  return uuid;
}

export async function getAccount(): Promise<MeOut> {
  return slabFetch<MeOut>("/account");
}

export async function searchCollection(
  query: CollectionSearchQuery = {},
): Promise<CollectionResult> {
  const collectorUuid = await getCollectorUuid();

  return slabFetch<CollectionResult>(
    `/collectors/${collectorUuid}/collection/search`,
    {
      method: "POST",
      body: JSON.stringify({
        limit: 48,
        offset: 0,
        ...query,
      }),
    },
  );
}

export async function searchSets(
  query: SetSearchQuery = {},
): Promise<SetSearchResult> {
  return slabFetch<SetSearchResult>("/sets/search", {
    method: "POST",
    body: JSON.stringify({
      limit: 20,
      offset: 0,
      ...query,
    }),
  });
}

export async function getSetSealed(setUuid: string): Promise<SealedProductOut[]> {
  return slabFetch<SealedProductOut[]>(`/sets/${setUuid}/sealed`);
}

export async function searchCards(
  query: CardSearchQuery = {},
): Promise<CardSearchResult> {
  return slabFetch<CardSearchResult>("/cards/search", {
    method: "POST",
    body: JSON.stringify({
      limit: 20,
      offset: 0,
      include_market: true,
      ...query,
    }),
  });
}

export async function getCardMarket(cardUuid: string): Promise<CardMarket> {
  return slabFetch<CardMarket>(`/cards/${cardUuid}/market`);
}

export interface CardCompsQuery {
  grade_key?: string;
  limit?: number;
}

export async function getCardComps(
  cardUuid: string,
  query: CardCompsQuery = {},
): Promise<CardComps> {
  const params = new URLSearchParams();
  if (query.grade_key) params.set("grade_key", query.grade_key);
  if (query.limit) params.set("limit", String(query.limit));

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return slabFetch<CardComps>(`/cards/${cardUuid}/comps${suffix}`);
}

export async function getCardParallels(cardUuid: string): Promise<CardOut[]> {
  return slabFetch<CardOut[]>(`/cards/${cardUuid}/parallels`);
}

export interface CardPriceHistoryQuery {
  grade_key?: string;
  finish?: string | null;
  start?: string;
  end?: string;
  interval?: string;
}

export async function getCardPriceHistory(
  cardUuid: string,
  query: CardPriceHistoryQuery = {},
): Promise<CardPriceHistory> {
  const params = new URLSearchParams();
  params.set("grade_key", query.grade_key ?? "RAW");
  params.set("interval", query.interval ?? "daily");
  if (query.finish) params.set("finish", query.finish);
  if (query.start) params.set("start", query.start);
  if (query.end) params.set("end", query.end);

  return slabFetch<CardPriceHistory>(
    `/cards/${cardUuid}/price-history?${params.toString()}`,
  );
}

export async function getDashboard(): Promise<DashboardStats> {
  const collectorUuid = await getCollectorUuid();
  return slabFetch<DashboardStats>(`/collectors/${collectorUuid}/dashboard`);
}

export async function getPortfolioHistory(
  days = 90,
): Promise<PortfolioHistory> {
  const collectorUuid = await getCollectorUuid();
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const params = new URLSearchParams({
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    interval: days > 60 ? "weekly" : "daily",
  });

  return slabFetch<PortfolioHistory>(
    `/collectors/${collectorUuid}/portfolio/history?${params.toString()}`,
  );
}

export { SlabApiError };
