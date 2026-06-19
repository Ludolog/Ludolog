import {
  getSteamStoreApiBaseUrl,
  getSteamStoreCountryCode,
  getSteamStoreCurrency,
  getSteamStorePriceCacheTtlMinutes,
  getSteamStorePriceMaxPerRun,
  isSteamStorePriceEnabled
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { sourceConfidenceForDataSource } from "@/lib/services/price-source-utils";
import type { Game, GamePriceSnapshot, IntegrationLog, PriceSource, Store, StoreOffer } from "@/lib/types";
import type {
  ApiSteamStorePricePreview,
  ApiSteamStorePriceRefreshRequest,
  ApiSteamStorePriceRefreshResponse,
  ApiSteamStorePriceStatus,
  ApiSteamStorePriceTestRequest,
  ApiSteamStorePriceTestResponse
} from "@shared/api-types";

type SteamStoreErrorType = "disabled" | "api_http_error" | "invalid_response" | "no_price_data" | "timeout" | "network_error";

type Fetcher = typeof fetch;

type SteamPriceOverview = {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
};

type SteamAppDetails = {
  name?: string;
  type?: string;
  is_free?: boolean;
  price_overview?: SteamPriceOverview;
};

type SteamAppDetailsResponse = Record<string, { success?: boolean; data?: SteamAppDetails }>;

type NormalizedSteamStorePrice = ApiSteamStorePricePreview & {
  rawData: SteamAppDetails;
};

type CachedDetails = {
  expiresAt: number;
  payload: SteamAppDetailsResponse;
};

const detailsCache = new Map<string, CachedDetails>();

export class SteamStoreConnectorError extends Error {
  constructor(
    message: string,
    readonly errorType: SteamStoreErrorType,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = "SteamStoreConnectorError";
  }
}

export class SteamStorePriceConnector {
  constructor(
    private readonly options: {
      fetcher?: Fetcher;
      apiBaseUrl?: string;
      countryCode?: string;
      currency?: string;
      cacheTtlMinutes?: number;
    } = {}
  ) {}

  async getAppDetails(steamAppId: number): Promise<SteamAppDetailsResponse> {
    const countryCode = this.options.countryCode ?? getSteamStoreCountryCode();
    const cacheKey = `${this.apiBaseUrl}|${countryCode}|${steamAppId}`;
    const cached = detailsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const url = new URL(`${this.apiBaseUrl}/appdetails`);
    url.searchParams.set("appids", String(steamAppId));
    url.searchParams.set("cc", countryCode);
    url.searchParams.set("filters", "price_overview,basic");

    const payload = (await fetchJson(url.toString(), this.options.fetcher ?? fetch)) as SteamAppDetailsResponse;
    detailsCache.set(cacheKey, {
      expiresAt: Date.now() + this.cacheTtlMinutes * 60 * 1000,
      payload
    });
    return payload;
  }

  private get apiBaseUrl(): string {
    return this.options.apiBaseUrl ?? getSteamStoreApiBaseUrl();
  }

  private get cacheTtlMinutes(): number {
    return this.options.cacheTtlMinutes ?? getSteamStorePriceCacheTtlMinutes();
  }
}

export class SteamStorePriceNormalizer {
  normalize(
    steamAppId: number,
    response: SteamAppDetailsResponse,
    countryCode = getSteamStoreCountryCode(),
    fallbackCurrency = getSteamStoreCurrency()
  ): NormalizedSteamStorePrice {
    const entry = response[String(steamAppId)];
    if (!entry?.success || !entry.data) {
      throw new SteamStoreConnectorError(`Steam Store returned no appdetails data for app ${steamAppId}.`, "no_price_data");
    }

    const data = entry.data;
    const priceOverview = data.price_overview;
    const externalUrl = `https://store.steampowered.com/app/${steamAppId}`;

    if (!priceOverview) {
      if (data.is_free === true) {
        return {
          steamAppId,
          title: data.name ?? null,
          storeName: "Steam",
          storeType: "official",
          sourceName: "steam-store",
          sourceType: "store-api-experimental",
          price: 0,
          regularPrice: 0,
          currency: fallbackCurrency,
          countryCode,
          discountPercent: 0,
          drm: "Steam",
          externalUrl,
          available: true,
          isFreeToPlay: true,
          rawData: data
        };
      }
      throw new SteamStoreConnectorError(`Steam Store has no usable price data for app ${steamAppId}.`, "no_price_data");
    }

    const price = minorUnitToMoney(priceOverview.final);
    const regularPrice = minorUnitToMoney(priceOverview.initial);
    if (price === null) {
      throw new SteamStoreConnectorError(`Steam Store price data is incomplete for app ${steamAppId}.`, "invalid_response");
    }

    return {
      steamAppId,
      title: data.name ?? null,
      storeName: "Steam",
      storeType: "official",
      sourceName: "steam-store",
      sourceType: "store-api-experimental",
      price,
      regularPrice: regularPrice ?? price,
      currency: (priceOverview.currency ?? fallbackCurrency).toUpperCase(),
      countryCode,
      discountPercent: normalizeDiscount(priceOverview.discount_percent, price, regularPrice ?? price),
      drm: "Steam",
      externalUrl,
      available: true,
      isFreeToPlay: data.is_free === true || price === 0,
      rawData: data
    };
  }
}

export class SteamStorePriceService {
  private readonly connector = new SteamStorePriceConnector();
  private readonly normalizer = new SteamStorePriceNormalizer();

  async status(): Promise<ApiSteamStorePriceStatus> {
    const [logs, offerCount, snapshotCount] = await Promise.all([
      repositories.diagnostics.listIntegrationLogs(),
      repositories.games.countOffersBySource("steam-store"),
      repositories.snapshots.countPriceSnapshotsBySource("steam-store")
    ]);
    const steamLogs = logs.filter((log) => log.service === "steam-store");
    const lastRefreshLog = steamLogs.find((log) => log.message.startsWith("Steam Store price refresh finished"));

    return {
      steamStorePriceEnabled: isSteamStorePriceEnabled(),
      countryCode: getSteamStoreCountryCode(),
      currency: getSteamStoreCurrency(),
      maxPerRun: getSteamStorePriceMaxPerRun(),
      cacheTtlMinutes: getSteamStorePriceCacheTtlMinutes(),
      steamStoreOfferCount: offerCount,
      steamStorePriceSnapshotCount: snapshotCount,
      lastSteamStorePriceRefresh: lastRefreshLog?.createdAt.toISOString() ?? null,
      lastSteamStorePriceError: steamLogs.find((log) => log.level === "error") ? toApiLog(steamLogs.find((log) => log.level === "error")!) : null,
      statusMessage: isSteamStorePriceEnabled() ? null : "Steam Store price connector disabled by environment.",
      integrationLogs: steamLogs.map(toApiLog)
    };
  }

  async testPrice(input: ApiSteamStorePriceTestRequest): Promise<ApiSteamStorePriceTestResponse> {
    ensureSteamStoreEnabled();
    const connector = new SteamStorePriceConnector({
      countryCode: input.countryCode ?? getSteamStoreCountryCode(),
      currency: input.currency ?? getSteamStoreCurrency()
    });
    const payload = await connector.getAppDetails(input.steamAppId);
    return {
      configured: true,
      result: previewOnly(
        this.normalizer.normalize(input.steamAppId, payload, input.countryCode ?? getSteamStoreCountryCode(), input.currency ?? getSteamStoreCurrency())
      ),
      error: null
    };
  }

  async refreshPrices(input: ApiSteamStorePriceRefreshRequest): Promise<ApiSteamStorePriceRefreshResponse> {
    ensureSteamStoreEnabled();
    const limit = Math.min(input.limit ?? getSteamStorePriceMaxPerRun(), getSteamStorePriceMaxPerRun());
    const games = await this.resolveRefreshGames(input, limit);
    const response: ApiSteamStorePriceRefreshResponse = {
      provider: "gamevalue",
      sourceName: "steam-store",
      dryRun: input.dryRun ?? true,
      requested: games.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      results: []
    };

    for (const game of games) {
      try {
        const payload = await this.connector.getAppDetails(game.steamAppId);
        const normalized = this.normalizer.normalize(game.steamAppId, payload);
        if (response.dryRun) {
          response.skipped += 1;
          response.results.push({
            gameId: game.id,
            steamAppId: game.steamAppId,
            refreshed: false,
            skipped: true,
            offerId: null,
            snapshotId: null,
            message: "Dry run only; no Steam Store price data was written."
          });
          continue;
        }

        const written = await this.writePrice(game, normalized);
        response.refreshed += 1;
        response.results.push({
          gameId: game.id,
          steamAppId: game.steamAppId,
          refreshed: true,
          skipped: false,
          offerId: written.offerId,
          snapshotId: written.snapshotId,
          message: null
        });
      } catch (error) {
        const message = sanitizeSteamStoreError(error);
        response.failed += 1;
        response.errors.push({ gameId: game.id, steamAppId: game.steamAppId, message });
        response.results.push({
          gameId: game.id,
          steamAppId: game.steamAppId,
          refreshed: false,
          skipped: false,
          offerId: null,
          snapshotId: null,
          message
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam-store",
      level: response.failed > 0 ? "warning" : "info",
      message: `Steam Store price refresh finished. dryRun=${response.dryRun}, requested=${response.requested}, refreshed=${response.refreshed}, skipped=${response.skipped}, failed=${response.failed}.`
    });

    return response;
  }

  private async resolveRefreshGames(input: ApiSteamStorePriceRefreshRequest, limit: number): Promise<Game[]> {
    const seen = new Set<string>();
    const games: Game[] = [];
    const pushGame = (game: Game | null): void => {
      if (game && !seen.has(game.id) && games.length < limit) {
        seen.add(game.id);
        games.push(game);
      }
    };

    for (const gameId of input.gameIds ?? []) {
      pushGame(await repositories.games.findById(gameId));
    }
    for (const steamAppId of input.steamAppIds ?? []) {
      pushGame(await repositories.games.findBySteamAppId(steamAppId));
    }
    if (games.length === 0 && !input.gameIds?.length && !input.steamAppIds?.length) {
      for (const game of await repositories.games.listImported(limit)) {
        pushGame(game);
      }
    }
    return games;
  }

  private async writePrice(game: Game, normalized: NormalizedSteamStorePrice): Promise<{ offerId: string; snapshotId: string }> {
    const now = new Date();
    const [storeResult, sourceResult, history] = await Promise.all([
      repositories.prices.upsertStore({
        name: "Steam",
        slug: "steam",
        storeType: "official",
        websiteUrl: "https://store.steampowered.com/"
      }),
      repositories.prices.upsertPriceSource({
        name: "steam-store",
        type: "store-api-experimental"
      }),
      repositories.snapshots.listPrices(game.id)
    ]);
    const previousRealLows = history
      .filter((snapshot) => snapshot.source !== "mock")
      .map((snapshot) => snapshot.historicalLow)
      .filter((value) => Number.isFinite(value));
    const historicalLow = Math.min(normalized.price, ...(previousRealLows.length > 0 ? previousRealLows : [normalized.price]));
    const offer = buildSteamStoreOffer(game, normalized, storeResult.store, sourceResult.source, historicalLow, now);
    const snapshot = buildSteamStoreSnapshot(game, normalized, sourceResult.source, historicalLow, now);

    await repositories.games.upsertOffers(game.id, [offer]);
    await repositories.snapshots.appendPrice(snapshot);

    return { offerId: offer.id, snapshotId: snapshot.id };
  }
}

function buildSteamStoreOffer(
  game: Game,
  normalized: NormalizedSteamStorePrice,
  store: Store,
  source: PriceSource,
  historicalLow: number,
  now: Date
): StoreOffer {
  return {
    id: `offer-${game.id}-steam-store`,
    gameId: game.id,
    steamAppId: game.steamAppId,
    storeId: store.id,
    sourceId: source.id,
    provider: "steam-store",
    storeName: "Steam",
    storeType: "official",
    title: normalized.title ?? game.title,
    price: normalized.price,
    regularPrice: normalized.regularPrice,
    historicalLow,
    currency: normalized.currency,
    discountPercent: normalized.discountPercent,
    url: normalized.externalUrl,
    externalUrl: normalized.externalUrl,
    region: normalized.countryCode,
    isOfficial: true,
    isOfficialStore: true,
    isHistoricalLow: normalized.price <= historicalLow,
    available: normalized.available,
    drm: "Steam",
    platform: game.platform,
    sourceRawId: `steam-store:${game.steamAppId}`,
    rawProviderData: {
      steamAppId: game.steamAppId,
      fetchedAt: now.toISOString(),
      isFreeToPlay: normalized.isFreeToPlay,
      priceOverviewPresent: Boolean(normalized.rawData.price_overview)
    },
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
    source: "steam-store",
    sourceConfidence: sourceConfidenceForDataSource("steam-store"),
    sourceName: "steam-store",
    sourceType: "store-api-experimental"
  };
}

function buildSteamStoreSnapshot(
  game: Game,
  normalized: NormalizedSteamStorePrice,
  source: PriceSource,
  historicalLow: number,
  now: Date
): GamePriceSnapshot {
  const basePrice = normalized.regularPrice ?? normalized.price;
  return {
    id: `price-${game.id}-steam-store-${now.getTime()}`,
    gameId: game.id,
    steamAppId: game.steamAppId,
    sourceId: source.id,
    provider: "steam-store",
    storeType: "official",
    price: normalized.price,
    bestPrice: normalized.price,
    historicalLow,
    basePrice,
    discountPercent: normalized.discountPercent,
    storeName: "Steam",
    currency: normalized.currency,
    externalUrl: normalized.externalUrl,
    offerCount: 1,
    isHistoricalLow: normalized.price <= historicalLow,
    sourceRawId: `steam-store:${game.steamAppId}`,
    rawProviderData: {
      steamAppId: game.steamAppId,
      fetchedAt: now.toISOString(),
      isFreeToPlay: normalized.isFreeToPlay,
      priceOverviewPresent: Boolean(normalized.rawData.price_overview)
    },
    fetchedAt: now,
    capturedAt: now,
    createdAt: now,
    source: "steam-store",
    sourceConfidence: sourceConfidenceForDataSource("steam-store"),
    sourceName: "steam-store",
    sourceType: "store-api-experimental"
  };
}

function previewOnly(normalized: NormalizedSteamStorePrice): ApiSteamStorePricePreview {
  const { rawData: _, ...preview } = normalized;
  return preview;
}

async function fetchJson(url: string, fetcher: Fetcher): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json", "user-agent": "GameValueRadar/1.0" },
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (!contentType.toLowerCase().includes("json")) {
      throw new SteamStoreConnectorError("Steam Store returned a non-JSON response.", "invalid_response", response.status);
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new SteamStoreConnectorError("Steam Store returned invalid JSON.", "invalid_response", response.status);
    }
    if (!response.ok) {
      throw new SteamStoreConnectorError(`Steam Store responded with HTTP ${response.status}.`, "api_http_error", response.status);
    }
    return json;
  } catch (error) {
    if (error instanceof SteamStoreConnectorError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new SteamStoreConnectorError("The Steam Store request timed out.", "timeout");
    }
    throw new SteamStoreConnectorError("The Steam Store request failed.", "network_error");
  } finally {
    clearTimeout(timeout);
  }
}

function minorUnitToMoney(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value) / 100;
}

function normalizeDiscount(discount: number | undefined, price: number, regularPrice: number): number {
  if (typeof discount === "number" && Number.isFinite(discount)) {
    return Math.max(0, Math.min(100, Math.round(discount)));
  }
  if (regularPrice <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((1 - price / regularPrice) * 100)));
}

function ensureSteamStoreEnabled(): void {
  if (!isSteamStorePriceEnabled()) {
    throw new SteamStoreConnectorError(
      "Steam Store price connector is disabled. Set STEAM_STORE_PRICE_ENABLED=true before calling Steam Store price APIs.",
      "disabled"
    );
  }
}

function sanitizeSteamStoreError(error: unknown): string {
  if (error instanceof SteamStoreConnectorError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Steam Store price refresh failed.";
}

function toApiLog(log: IntegrationLog) {
  return {
    ...log,
    createdAt: log.createdAt.toISOString()
  };
}

export const steamStorePriceService = new SteamStorePriceService();
