import {
  getDataMode,
  getGGDealsApiBaseUrl,
  getGGDealsApiKey,
  getPriceMode,
  getPriceProvider
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import type { Game, GamePriceSnapshot, PriceProviderName, StoreOffer, StoreType } from "@/lib/types";
import type { ApiPriceRefreshResponse, ApiPriceRefreshResult } from "@shared/api-types";

export type NormalizedPriceOffer = {
  provider: PriceProviderName | string;
  steamAppId: number;
  storeName: string;
  storeType: StoreType;
  price: number;
  regularPrice: number | null;
  discountPercent: number;
  currency: string;
  url: string;
  isHistoricalLow: boolean;
  historicalLow: number | null;
  fetchedAt: Date;
  sourceRawId?: string;
  rawProviderData?: unknown;
};

export type PriceRefreshOptions = {
  dryRun?: boolean;
  limit?: number;
  mode?: "imported" | "best";
  steamAppIds?: number[];
};

export interface PriceProvider {
  readonly name: PriceProviderName;
  getPricesBySteamAppId(steamAppId: number): Promise<NormalizedPriceOffer[]>;
  getPricesForGames(steamAppIds: number[]): Promise<Map<number, NormalizedPriceOffer[]>>;
}

type Fetcher = typeof fetch;

export class MockPriceProvider implements PriceProvider {
  readonly name = "mock";

  async getPricesBySteamAppId(steamAppId: number): Promise<NormalizedPriceOffer[]> {
    const game = await repositories.games.findBySteamAppId(steamAppId);
    if (!game) {
      return [];
    }

    const offers = await repositories.games.listOffers(game.id);
    return offers.map((offer) => ({
      provider: "mock",
      steamAppId,
      storeName: offer.storeName,
      storeType: offer.storeType,
      price: offer.price,
      regularPrice: offer.regularPrice,
      discountPercent: offer.discountPercent,
      currency: offer.currency,
      url: offer.externalUrl ?? offer.url,
      isHistoricalLow: offer.isHistoricalLow,
      historicalLow: offer.historicalLow,
      fetchedAt: offer.fetchedAt ?? offer.updatedAt,
      sourceRawId: offer.sourceRawId ?? undefined,
      rawProviderData: offer.rawProviderData ?? undefined
    }));
  }

  async getPricesForGames(steamAppIds: number[]): Promise<Map<number, NormalizedPriceOffer[]>> {
    const result = new Map<number, NormalizedPriceOffer[]>();
    for (const steamAppId of steamAppIds) {
      result.set(steamAppId, await this.getPricesBySteamAppId(steamAppId));
    }
    return result;
  }
}

export class GGDealsPriceProvider implements PriceProvider {
  readonly name = "ggdeals";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;

  constructor({
    apiKey,
    baseUrl = getGGDealsApiBaseUrl(),
    fetcher = fetch,
    timeoutMs = 10_000
  }: {
    apiKey: string;
    baseUrl?: string;
    fetcher?: Fetcher;
    timeoutMs?: number;
  }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
  }

  async getPricesBySteamAppId(steamAppId: number): Promise<NormalizedPriceOffer[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("ids", String(steamAppId));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(`GG.deals API responded with ${response.status}${summarizeProviderError(details)}.`);
      }
      const payload = await response.json();
      return normalizeGGDealsOffers(payload, steamAppId, new Date());
    } finally {
      clearTimeout(timeout);
    }
  }

  async getPricesForGames(steamAppIds: number[]): Promise<Map<number, NormalizedPriceOffer[]>> {
    const result = new Map<number, NormalizedPriceOffer[]>();
    for (const steamAppId of steamAppIds) {
      result.set(steamAppId, await this.getPricesBySteamAppId(steamAppId));
    }
    return result;
  }
}

export class PriceProviderService {
  async getPricesBySteamAppId(steamAppId: number): Promise<NormalizedPriceOffer[]> {
    return (await this.resolveProvider()).getPricesBySteamAppId(steamAppId);
  }

  async getPricesForGames(steamAppIds: number[]): Promise<Map<number, NormalizedPriceOffer[]>> {
    return (await this.resolveProvider()).getPricesForGames(unique(steamAppIds));
  }

  async refreshGamePrices(input: { gameId?: string; steamAppId?: number; dryRun?: boolean }): Promise<ApiPriceRefreshResponse> {
    const steamAppIds = typeof input.steamAppId === "number" ? [input.steamAppId] : [];
    const gameIds = input.gameId ? [input.gameId] : [];
    return this.refreshManyGamePrices({ gameIds, steamAppIds, dryRun: input.dryRun, limit: 1 });
  }

  async refreshManyGamePrices(options: PriceRefreshOptions & { gameIds?: string[] } = {}): Promise<ApiPriceRefreshResponse> {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 10)));
    const explicit = (options.steamAppIds?.length ?? 0) > 0 || (options.gameIds?.length ?? 0) > 0;
    const mode: ApiPriceRefreshResponse["mode"] = explicit ? "explicit" : options.mode === "best" ? "best" : "imported";
    const games = await this.resolveGames({ ...options, limit, mode });
    const provider = await this.resolveProvider();
    const response: ApiPriceRefreshResponse = {
      mode,
      dryRun: options.dryRun ?? false,
      requested: games.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      results: []
    };

    for (const game of games) {
      try {
        const offers = await provider.getPricesBySteamAppId(game.steamAppId);
        if (offers.length === 0) {
          response.skipped += 1;
          response.results.push(priceResult(game, provider.name, [], false, true));
          continue;
        }

        const storeOffers = offers.map((offer) => normalizedOfferToStoreOffer(game.id, offer));
        const bestOffer = storeOffers[0];
        if (!bestOffer) {
          response.skipped += 1;
          response.results.push(priceResult(game, provider.name, [], false, true));
          continue;
        }

        const snapshot = storeOfferToPriceSnapshot(game.id, game.steamAppId, bestOffer);
        if (!response.dryRun) {
          await repositories.games.upsertOffers(game.id, storeOffers);
          await repositories.snapshots.appendPrice(snapshot);
        }

        response.refreshed += 1;
        response.results.push(priceResult(game, provider.name, storeOffers, true, false));
      } catch (error) {
        response.failed += 1;
        response.errors.push({
          input: String(game.steamAppId),
          steamAppId: game.steamAppId,
          message: error instanceof Error ? error.message : "Unknown price refresh error."
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: provider.name === "ggdeals" ? "ggdeals" : "price",
      level: response.failed > 0 ? "warning" : "info",
      message: `Price refresh finished. provider=${provider.name}, mode=${mode}, requested=${response.requested}, refreshed=${response.refreshed}, skipped=${response.skipped}, failed=${response.failed}, dryRun=${response.dryRun}.`
    });

    return response;
  }

  private async resolveProvider(): Promise<PriceProvider> {
    const configuredProvider = getPriceProvider();
    const priceMode = getPriceMode();
    const key = getGGDealsApiKey();

    if (getDataMode() !== "api" || priceMode !== "api" || configuredProvider === "mock") {
      return new MockPriceProvider();
    }

    if (configuredProvider === "ggdeals" && key) {
      return new GGDealsPriceProvider({ apiKey: key });
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: "warning",
      message: `Price provider ${configuredProvider} is not ready. Mock price provider was used.`
    });
    return new MockPriceProvider();
  }

  private async resolveGames({
    gameIds,
    limit,
    mode,
    steamAppIds
  }: Omit<PriceRefreshOptions, "mode"> & {
    gameIds?: string[];
    limit: number;
    mode: ApiPriceRefreshResponse["mode"];
  }): Promise<Game[]> {
    if ((steamAppIds?.length ?? 0) > 0 || (gameIds?.length ?? 0) > 0) {
      const games: Game[] = [];
      const seen = new Set<number>();

      for (const steamAppId of unique(steamAppIds ?? []).slice(0, limit)) {
        const game = await repositories.games.findBySteamAppId(steamAppId);
        if (game && !seen.has(game.steamAppId)) {
          seen.add(game.steamAppId);
          games.push(game);
        }
      }

      for (const gameId of gameIds ?? []) {
        const game = await repositories.games.findById(gameId);
        if (game && !seen.has(game.steamAppId)) {
          seen.add(game.steamAppId);
          games.push(game);
        }
      }

      return games.slice(0, limit);
    }

    if (mode === "best") {
      const summaries = await repositories.games.bestDeals(limit);
      return summaries.map((summary) => summary.game);
    }

    return (await repositories.games.list()).slice(0, limit);
  }
}

export function normalizeGGDealsOffers(
  payload: unknown,
  steamAppId: number,
  fetchedAt = new Date()
): NormalizedPriceOffer[] {
  const records = collectRecords(payload);
  const offers = records
    .map((record) => normalizeGGDealsRecord(record, steamAppId, fetchedAt))
    .filter((offer): offer is NormalizedPriceOffer => offer !== null);
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const key = `${offer.storeName.toLowerCase()}|${offer.price}|${offer.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeGGDealsRecord(
  record: Record<string, unknown>,
  steamAppId: number,
  fetchedAt: Date
): NormalizedPriceOffer | null {
  const price = firstNumber(record, [
    "price",
    "price.amount",
    "price.value",
    "currentPrice",
    "currentPrice.amount",
    "current_price",
    "current_price.amount",
    "amount",
    "finalPrice",
    "finalPrice.amount",
    "final_price",
    "final_price.amount"
  ]);
  if (price === null) {
    return null;
  }

  const discountPercent = firstNumber(record, ["discountPercent", "discount", "discount_percent", "cut"]) ?? 0;
  const regularPrice =
    firstNumber(record, [
      "regularPrice",
      "regularPrice.amount",
      "regular_price",
      "regular_price.amount",
      "basePrice",
      "basePrice.amount",
      "base_price",
      "base_price.amount",
      "retailPrice",
      "retailPrice.amount",
      "oldPrice",
      "oldPrice.amount"
    ]) ??
    (discountPercent > 0 ? roundMoney(price / Math.max(0.01, 1 - discountPercent / 100)) : price);
  const storeName = firstString(record, ["storeName", "store", "shopName", "shop", "merchant"]) ?? "GG.deals";
  const url =
    firstString(record, ["url", "urlRedirect", "dealUrl", "deal_url", "redirectUrl", "redirect_url"]) ??
    "https://gg.deals/";
  const historicalLow = firstNumber(record, [
    "historicalLow",
    "historicalLow.amount",
    "historical_low",
    "historical_low.amount",
    "lowestPrice",
    "lowestPrice.amount",
    "lowest_price",
    "lowest_price.amount"
  ]);

  return {
    provider: "ggdeals",
    steamAppId,
    storeName,
    storeType: resolveStoreType(record),
    price: roundMoney(price),
    regularPrice: regularPrice === null ? null : roundMoney(regularPrice),
    discountPercent: Math.max(0, Math.round(discountPercent)),
    currency: firstString(record, ["currency", "price.currency", "currencyCode", "currency_code"]) ?? "PLN",
    url,
    isHistoricalLow: firstBoolean(record, ["isHistoricalLow", "is_historical_low", "historicalLowMatched"]) ?? false,
    historicalLow: historicalLow === null ? null : roundMoney(historicalLow),
    fetchedAt,
    sourceRawId: firstString(record, ["id", "dealId", "deal_id", "offerId", "offer_id"]),
    rawProviderData: record
  };
}

function collectRecords(value: unknown): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];

  function visit(item: unknown): void {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (!isRecord(item)) {
      return;
    }

    if (looksLikeOffer(item)) {
      records.push(item);
    }

    for (const child of Object.values(item)) {
      if (Array.isArray(child) || isRecord(child)) {
        visit(child);
      }
    }
  }

  visit(value);
  return records;
}

function looksLikeOffer(record: Record<string, unknown>): boolean {
  return (
    firstNumber(record, [
      "price",
      "price.amount",
      "price.value",
      "currentPrice",
      "currentPrice.amount",
      "current_price",
      "current_price.amount",
      "amount",
      "finalPrice",
      "finalPrice.amount",
      "final_price",
      "final_price.amount"
    ]) !== null
  );
}

function normalizedOfferToStoreOffer(gameId: string, offer: NormalizedPriceOffer): StoreOffer {
  return {
    id: `offer-${gameId}-${slugify(String(offer.provider))}-${slugify(offer.sourceRawId ?? offer.storeName)}`,
    gameId,
    provider: offer.provider,
    storeName: offer.storeName,
    storeType: offer.storeType,
    price: offer.price,
    regularPrice: offer.regularPrice,
    historicalLow: offer.historicalLow,
    currency: offer.currency,
    discountPercent: offer.discountPercent,
    url: offer.url,
    externalUrl: offer.url,
    isOfficial: offer.storeType === "official",
    isHistoricalLow: offer.isHistoricalLow,
    drm: offer.storeType === "official" ? "Steam" : "Key",
    sourceRawId: offer.sourceRawId ?? null,
    rawProviderData: offer.rawProviderData ?? null,
    fetchedAt: offer.fetchedAt,
    updatedAt: offer.fetchedAt,
    source: offer.provider === "ggdeals" ? "ggdeals" : offer.provider === "mock" ? "mock" : "price-api"
  };
}

function storeOfferToPriceSnapshot(gameId: string, steamAppId: number, offer: StoreOffer): GamePriceSnapshot {
  const capturedAt = offer.fetchedAt ?? new Date();
  return {
    id: `price-${gameId}-${offer.provider}-${capturedAt.getTime()}-${steamAppId}`,
    gameId,
    provider: offer.provider,
    storeType: offer.storeType,
    price: offer.price,
    historicalLow: offer.historicalLow ?? offer.price,
    basePrice: offer.regularPrice ?? offer.price,
    discountPercent: offer.discountPercent,
    storeName: offer.storeName,
    currency: offer.currency,
    externalUrl: offer.externalUrl,
    isHistoricalLow: offer.isHistoricalLow,
    sourceRawId: offer.sourceRawId,
    rawProviderData: offer.rawProviderData,
    fetchedAt: offer.fetchedAt,
    capturedAt,
    source: offer.source
  };
}

function priceResult(
  game: Game,
  provider: string,
  offers: StoreOffer[],
  refreshed: boolean,
  skipped: boolean
): ApiPriceRefreshResult {
  const bestOffer = offers[0] ?? null;
  return {
    input: String(game.steamAppId),
    gameId: game.id,
    steamAppId: game.steamAppId,
    title: game.title,
    provider,
    offerCount: offers.length,
    refreshed,
    skipped,
    bestPrice: bestOffer?.price ?? null,
    storeName: bestOffer?.storeName ?? null
  };
}

function resolveStoreType(record: Record<string, unknown>): StoreType {
  const raw =
    firstString(record, ["storeType", "store_type", "shopType", "shop_type", "type"])?.toLowerCase() ?? "";
  if (raw.includes("official") || firstBoolean(record, ["isOfficial", "isOfficialStore", "official"]) === true) {
    return "official";
  }
  if (raw.includes("market")) {
    return "marketplace";
  }
  if (raw.includes("key") || firstBoolean(record, ["isKeyshop", "keyshop"]) === true) {
    return "keyshop";
  }
  return "unknown";
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = readPath(record, key);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const normalized = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }
  }
  return null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readPath(record, key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (isRecord(value)) {
      const nestedName = firstString(value, ["name", "title", "label"]);
      if (nestedName) {
        return nestedName;
      }
    }
  }
  return undefined;
}

function firstBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = readPath(record, key);
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function readPath(record: Record<string, unknown>, key: string): unknown {
  if (key in record) {
    return record[key];
  }
  const parts = key.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "offer";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

function summarizeProviderError(details: string): string {
  const trimmed = details.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }
  return `: ${trimmed.slice(0, 160)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const priceProviderService = new PriceProviderService();
