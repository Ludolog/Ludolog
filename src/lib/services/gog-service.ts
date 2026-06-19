import {
  getGogApiBaseUrl,
  getGogCatalogBaseUrl,
  getGogCountryCode,
  getGogCurrency,
  getGogRequestLimitPerHour,
  isGogEnabled
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import type {
  Game,
  GameExternalMapping,
  GamePriceSnapshot,
  GogCatalogEntry,
  GogMappingConfidence,
  IntegrationLog,
  PriceSource,
  Store,
  StoreOffer
} from "@/lib/types";

type Fetcher = typeof fetch;

type GogErrorType =
  | "disabled"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "api_http_error"
  | "invalid_response"
  | "no_price_data"
  | "not_found";

type GogCatalogProduct = {
  id?: string | number;
  title?: string;
  slug?: string;
  productType?: string;
  price?: {
    final?: string;
    base?: string;
    discount?: string | number;
    finalMoney?: { amount?: string | number; currency?: string; discount?: string | number };
    baseMoney?: { amount?: string | number; currency?: string };
  };
  storeLink?: string;
  coverHorizontal?: string;
  coverVertical?: string;
  images?: Record<string, unknown>;
  [key: string]: unknown;
};

type GogCatalogResponse = {
  products?: GogCatalogProduct[];
  [key: string]: unknown;
};

type GogProductResponse = {
  id?: string | number;
  title?: string;
  slug?: string;
  links?: { product_card?: string; purchase_link?: string };
  [key: string]: unknown;
};

type NormalizedGogPrice = {
  gogProductId: string;
  title: string;
  slug: string;
  price: number;
  regularPrice: number | null;
  currency: string;
  countryCode: string;
  discountPercent: number;
  externalUrl: string;
  available: boolean;
  rawData: GogCatalogProduct;
};

type GogSuggestion = GogCatalogEntry & { confidence: GogMappingConfidence; reason: string };

const requestTimestamps: number[] = [];
const hourMs = 60 * 60 * 1000;

export class GogConnectorError extends Error {
  constructor(
    message: string,
    readonly errorType: GogErrorType,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = "GogConnectorError";
  }
}

export class GogCatalogConnector {
  constructor(
    private readonly options: {
      catalogBaseUrl?: string;
      countryCode?: string;
      currency?: string;
      fetcher?: Fetcher;
      timeoutMs?: number;
      maxRetries?: number;
    } = {}
  ) {}

  async search(query: string, limit = 10): Promise<GogCatalogProduct[]> {
    const url = new URL(`${this.catalogBaseUrl}/v1/catalog`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));
    url.searchParams.set("countryCode", this.countryCode);
    url.searchParams.set("currency", this.currency);
    url.searchParams.set("locale", this.countryCode === "PL" ? "pl-PL" : "en-US");

    const payload = (await fetchJson(url, this.fetcher, {
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries
    })) as GogCatalogResponse;

    if (!Array.isArray(payload.products)) {
      throw new GogConnectorError("GOG catalog returned JSON without a products array.", "invalid_response");
    }

    return payload.products;
  }

  private get catalogBaseUrl(): string {
    return this.options.catalogBaseUrl ?? getGogCatalogBaseUrl();
  }

  private get countryCode(): string {
    return this.options.countryCode ?? getGogCountryCode();
  }

  private get currency(): string {
    return this.options.currency ?? getGogCurrency();
  }

  private get fetcher(): Fetcher {
    return this.options.fetcher ?? fetch;
  }

  private get timeoutMs(): number {
    return this.options.timeoutMs ?? 10_000;
  }

  private get maxRetries(): number {
    return this.options.maxRetries ?? 1;
  }
}

export class GogPriceConnector {
  constructor(
    private readonly options: {
      apiBaseUrl?: string;
      catalogConnector?: GogCatalogConnector;
      fetcher?: Fetcher;
      countryCode?: string;
      currency?: string;
      timeoutMs?: number;
      maxRetries?: number;
    } = {}
  ) {}

  async getProductMetadata(gogProductId: string): Promise<GogProductResponse> {
    const url = new URL(`${this.apiBaseUrl}/products/${encodeURIComponent(gogProductId)}`);
    url.searchParams.set("countryCode", this.countryCode);
    url.searchParams.set("currency", this.currency);

    return (await fetchJson(url, this.fetcher, {
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries
    })) as GogProductResponse;
  }

  async getCatalogProduct(input: { gogProductId: string; externalSlug?: string | null; title?: string | null }): Promise<GogCatalogProduct> {
    let query = input.externalSlug ?? input.title ?? input.gogProductId;
    if (!input.externalSlug && !input.title) {
      const metadata = await this.getProductMetadata(input.gogProductId);
      query = metadata.slug ?? metadata.title ?? input.gogProductId;
    }

    const products = await this.catalogConnector.search(query, 20);
    const exact = products.find((product) => String(product.id) === input.gogProductId);
    if (exact) {
      return exact;
    }

    const slug = normalizeSlug(input.externalSlug ?? query);
    const slugMatch = products.find((product) => normalizeSlug(product.slug) === slug);
    if (slugMatch && String(slugMatch.id) === input.gogProductId) {
      return slugMatch;
    }

    throw new GogConnectorError(`GOG product ${input.gogProductId} was not found in catalog search results.`, "not_found");
  }

  private get apiBaseUrl(): string {
    return this.options.apiBaseUrl ?? getGogApiBaseUrl();
  }

  private get catalogConnector(): GogCatalogConnector {
    return (
      this.options.catalogConnector ??
      new GogCatalogConnector({
        countryCode: this.countryCode,
        currency: this.currency,
        fetcher: this.fetcher,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries
      })
    );
  }

  private get countryCode(): string {
    return this.options.countryCode ?? getGogCountryCode();
  }

  private get currency(): string {
    return this.options.currency ?? getGogCurrency();
  }

  private get fetcher(): Fetcher {
    return this.options.fetcher ?? fetch;
  }

  private get timeoutMs(): number {
    return this.options.timeoutMs ?? 10_000;
  }

  private get maxRetries(): number {
    return this.options.maxRetries ?? 1;
  }
}

export class GogPriceNormalizer {
  normalize(product: GogCatalogProduct, countryCode = getGogCountryCode(), fallbackCurrency = getGogCurrency()): NormalizedGogPrice {
    const gogProductId = product.id === undefined ? "" : String(product.id);
    const title = product.title?.trim() ?? "";
    const slug = product.slug?.trim() ?? "";
    const price = moneyAmount(product.price?.finalMoney?.amount);
    const regularPrice = moneyAmount(product.price?.baseMoney?.amount);
    const currency = product.price?.finalMoney?.currency ?? product.price?.baseMoney?.currency ?? fallbackCurrency;

    if (!gogProductId || !title || !slug) {
      throw new GogConnectorError("GOG product JSON is missing id, title or slug.", "invalid_response");
    }

    if (price === null) {
      throw new GogConnectorError(`GOG product ${gogProductId} has no usable price data.`, "no_price_data");
    }

    return {
      gogProductId,
      title,
      slug,
      price,
      regularPrice,
      currency,
      countryCode,
      discountPercent: discountPercent(product.price?.discount, price, regularPrice),
      externalUrl: product.storeLink ?? `https://www.gog.com/game/${slug}`,
      available: true,
      rawData: product
    };
  }
}

export class GogProductMapper {
  suggest(game: Game, entries: GogCatalogEntry[]): GogSuggestion[] {
    const gameTitle = normalizeTitle(game.title);
    const gameSlug = normalizeSlug(game.slug);

    return entries.map((entry) => {
      const entryTitle = normalizeTitle(entry.title);
      const entrySlug = normalizeSlug(entry.slug);
      if (entrySlug === gameSlug || entryTitle === gameTitle) {
        return { ...entry, confidence: "exact", reason: "Normalized title or slug is an exact match." };
      }
      if (entryTitle.includes(gameTitle) || gameTitle.includes(entryTitle)) {
        return { ...entry, confidence: "title-match", reason: "Title is a close containment match." };
      }
      return { ...entry, confidence: "unknown", reason: "Potential fuzzy match. Manual approval required." };
    });
  }
}

export class GogService {
  private readonly catalogConnector = new GogCatalogConnector();
  private readonly priceConnector = new GogPriceConnector({ catalogConnector: this.catalogConnector });
  private readonly normalizer = new GogPriceNormalizer();
  private readonly mapper = new GogProductMapper();

  async status() {
    const [repositoryStatus, logs, gogOfferCount, gogPriceSnapshotCount, lastGogPriceRefresh] = await Promise.all([
      repositories.gog.status(),
      repositories.diagnostics.listIntegrationLogs(30),
      repositories.games.countOffersBySource("gog"),
      repositories.snapshots.countPriceSnapshotsBySource("gog"),
      latestGogPriceRefresh()
    ]);
    const gogLogs = logs.filter((log) => log.service === "gog");

    return {
      gogEnabled: isGogEnabled(),
      gogCatalogEntries: repositoryStatus.gogCatalogEntries,
      gogMappings: repositoryStatus.gogMappings,
      gogMappedGames: repositoryStatus.gogMappings,
      lastGogSync: repositoryStatus.lastGogSync,
      lastGogCatalogSearch: repositoryStatus.lastGogCatalogSearch,
      lastGogError: gogLogs.find((log) => log.level === "error") ?? null,
      requestLimitPerHour: getGogRequestLimitPerHour(),
      countryCode: getGogCountryCode(),
      currency: getGogCurrency(),
      gogOfferCount,
      gogPriceSnapshotCount,
      lastGogPriceRefresh,
      statusMessage: isGogEnabled() ? null : "GOG connector disabled by environment.",
      integrationLogs: gogLogs
    };
  }

  async listMappings(limit = 100): Promise<GameExternalMapping[]> {
    return repositories.gog.listMappings(limit);
  }

  async upsertMapping(input: {
    gameId: string;
    gogProductId: string;
    externalSlug?: string | null;
    confidence?: GogMappingConfidence;
  }): Promise<GameExternalMapping> {
    const game = await repositories.games.findById(input.gameId);
    if (!game) {
      throw new GogConnectorError(`Game ${input.gameId} was not found.`, "not_found");
    }

    const mapping = await repositories.gog.upsertMapping({
      gameId: input.gameId,
      externalId: input.gogProductId,
      externalSlug: input.externalSlug ?? null,
      confidence: input.confidence ?? "manual"
    });
    await logGog("info", `GOG mapping saved. gameId=${input.gameId}, gogProductId=${input.gogProductId}, confidence=${mapping.confidence}.`);
    return mapping;
  }

  async searchCatalog(input: { query: string; limit?: number }) {
    ensureEnabled();
    const products = await this.catalogConnector.search(input.query, input.limit ?? 10);
    const entries = products.map((product) => catalogProductToEntry(product, new Date()));
    const upserted = await repositories.gog.upsertCatalogEntries(entries);
    await logGog(
      "info",
      `GOG catalog search completed. query="${safeLogText(input.query)}", results=${entries.length}, created=${upserted.created}, updated=${upserted.updated}.`
    );
    return { query: input.query, results: entries, upserted };
  }

  async resolveGame(input: { gameId: string; limit?: number }) {
    const game = await repositories.games.findById(input.gameId);
    if (!game) {
      throw new GogConnectorError(`Game ${input.gameId} was not found.`, "not_found");
    }

    const existingMapping = await repositories.gog.findMappingByGameId(game.id);
    if (existingMapping) {
      return { gameId: game.id, existingMapping, suggestions: [] as GogSuggestion[] };
    }

    ensureEnabled();
    const search = await this.searchCatalog({ query: game.title, limit: input.limit ?? 10 });
    const suggestions = this.mapper.suggest(game, search.results);
    return { gameId: game.id, existingMapping: null, suggestions };
  }

  async testPrice(input: { gogProductId: string; externalSlug?: string | null; countryCode?: string; currency?: string }) {
    ensureEnabled();
    const connector = new GogPriceConnector({
      countryCode: input.countryCode ?? getGogCountryCode(),
      currency: input.currency ?? getGogCurrency()
    });
    const product = await connector.getCatalogProduct({
      gogProductId: input.gogProductId,
      externalSlug: input.externalSlug
    });
    const normalized = this.normalizer.normalize(product, input.countryCode ?? getGogCountryCode(), input.currency ?? getGogCurrency());

    return {
      configured: true,
      result: normalizedToPreview(normalized),
      error: null
    };
  }

  async refreshPrices(input: { mode?: "mapped-games"; gameIds?: string[]; limit?: number }) {
    ensureEnabled();
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 10);
    const mappings = await this.mappingsForRefresh(input.gameIds, limit);
    const result = {
      provider: "gamevalue" as const,
      sourceName: "gog" as const,
      requested: mappings.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ gameId: string; gogProductId?: string; message: string }>,
      results: [] as Array<{
        gameId: string;
        gogProductId: string;
        refreshed: boolean;
        skipped: boolean;
        offerId: string | null;
        snapshotId: string | null;
        message: string | null;
      }>
    };

    for (const mapping of mappings) {
      try {
        if (mapping.confidence === "unknown") {
          result.skipped += 1;
          result.results.push({
            gameId: mapping.gameId,
            gogProductId: mapping.externalId,
            refreshed: false,
            skipped: true,
            offerId: null,
            snapshotId: null,
            message: "Skipped unknown-confidence GOG mapping."
          });
          continue;
        }

        const game = await repositories.games.findById(mapping.gameId);
        if (!game) {
          throw new GogConnectorError(`Game ${mapping.gameId} was not found.`, "not_found");
        }

        const product = await this.priceConnector.getCatalogProduct({
          gogProductId: mapping.externalId,
          externalSlug: mapping.externalSlug,
          title: game.title
        });
        const normalized = this.normalizer.normalize(product);
        const write = await this.writePrice(game, mapping, normalized);
        result.refreshed += 1;
        result.results.push({
          gameId: game.id,
          gogProductId: mapping.externalId,
          refreshed: true,
          skipped: false,
          offerId: write.offer.id,
          snapshotId: write.snapshot.id,
          message: null
        });
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : "Unknown GOG price refresh error.";
        result.errors.push({ gameId: mapping.gameId, gogProductId: mapping.externalId, message });
        result.results.push({
          gameId: mapping.gameId,
          gogProductId: mapping.externalId,
          refreshed: false,
          skipped: false,
          offerId: null,
          snapshotId: null,
          message
        });
        await logGog("warning", `GOG price refresh failed. gameId=${mapping.gameId}, gogProductId=${mapping.externalId}, message=${safeLogText(message)}.`);
      }
    }

    await logGog(
      result.failed > 0 ? "warning" : "info",
      `GOG price refresh finished. requested=${result.requested}, refreshed=${result.refreshed}, skipped=${result.skipped}, failed=${result.failed}.`
    );

    return result;
  }

  private async mappingsForRefresh(gameIds: string[] | undefined, limit: number): Promise<GameExternalMapping[]> {
    if (gameIds && gameIds.length > 0) {
      return (await repositories.gog.findMappingsByGameIds(gameIds)).slice(0, limit);
    }
    return (await repositories.gog.listMappings(limit)).slice(0, limit);
  }

  private async writePrice(game: Game, mapping: GameExternalMapping, normalized: NormalizedGogPrice) {
    const [storeResult, sourceResult, priceHistory] = await Promise.all([
      repositories.prices.upsertStore({ name: "GOG", slug: "gog", storeType: "official", websiteUrl: "https://www.gog.com" }),
      repositories.prices.upsertPriceSource({ name: "gog", type: "store-api" }),
      repositories.snapshots.listPrices(game.id)
    ]);
    const historicalLow = Math.min(
      normalized.price,
      ...priceHistory.map((snapshot) => snapshot.historicalLow).filter((price) => Number.isFinite(price))
    );
    const now = new Date();
    const offer = buildGogOffer(game, mapping, normalized, storeResult.store, sourceResult.source, historicalLow, now);
    const snapshot = buildGogSnapshot(game, normalized, sourceResult.source, historicalLow, now);

    await repositories.games.upsertOffers(game.id, [offer]);
    await repositories.snapshots.appendPrice(snapshot);

    return { offer, snapshot };
  }
}

async function latestGogPriceRefresh(): Promise<Date | null> {
  const allGames = await repositories.games.list();
  const histories = await Promise.all(allGames.map((game) => repositories.snapshots.listPrices(game.id)));
  return histories
    .flat()
    .filter((snapshot) => snapshot.source === "gog")
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0]?.capturedAt ?? null;
}

function buildGogOffer(
  game: Game,
  mapping: GameExternalMapping,
  normalized: NormalizedGogPrice,
  store: Store,
  source: PriceSource,
  historicalLow: number,
  now: Date
): StoreOffer {
  return {
    id: `offer-${game.id}-gog-${normalized.gogProductId}`,
    gameId: game.id,
    steamAppId: game.steamAppId,
    storeId: store.id,
    sourceId: source.id,
    provider: "gamevalue",
    storeName: "GOG",
    storeType: "official",
    title: normalized.title,
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
    drm: "DRM-free",
    platform: "PC",
    sourceRawId: mapping.externalId,
    rawProviderData: normalized.rawData,
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
    source: "gog",
    sourceConfidence: "internal-real",
    sourceName: "gog",
    sourceType: "store-api"
  };
}

function buildGogSnapshot(
  game: Game,
  normalized: NormalizedGogPrice,
  source: PriceSource,
  historicalLow: number,
  now: Date
): GamePriceSnapshot {
  return {
    id: `price-${game.id}-gog-${now.getTime()}`,
    gameId: game.id,
    steamAppId: game.steamAppId,
    sourceId: source.id,
    provider: "gamevalue",
    storeType: "official",
    price: normalized.price,
    bestPrice: normalized.price,
    historicalLow,
    basePrice: normalized.regularPrice ?? normalized.price,
    discountPercent: normalized.discountPercent,
    storeName: "GOG",
    currency: normalized.currency,
    externalUrl: normalized.externalUrl,
    offerCount: 1,
    isHistoricalLow: normalized.price <= historicalLow,
    sourceRawId: normalized.gogProductId,
    rawProviderData: normalized.rawData,
    fetchedAt: now,
    capturedAt: now,
    createdAt: now,
    source: "gog",
    sourceConfidence: "internal-real",
    sourceName: "gog",
    sourceType: "store-api"
  };
}

function catalogProductToEntry(product: GogCatalogProduct, syncedAt: Date): GogCatalogEntry {
  const gogProductId = product.id === undefined ? "" : String(product.id);
  const title = product.title?.trim() ?? "";
  const slug = product.slug?.trim() ?? "";
  if (!gogProductId || !title || !slug) {
    throw new GogConnectorError("GOG catalog product is missing id, title or slug.", "invalid_response");
  }

  return {
    id: `gog-catalog-${gogProductId}`,
    gogProductId,
    title,
    slug,
    url: product.storeLink ?? `https://www.gog.com/game/${slug}`,
    imageUrl: product.coverHorizontal ?? product.coverVertical ?? null,
    isActive: true,
    productType: product.productType ?? null,
    rawData: product,
    syncedAt,
    createdAt: syncedAt,
    updatedAt: syncedAt
  };
}

function normalizedToPreview(normalized: NormalizedGogPrice) {
  return {
    gogProductId: normalized.gogProductId,
    title: normalized.title,
    slug: normalized.slug,
    storeName: "GOG" as const,
    storeType: "official" as const,
    sourceName: "gog" as const,
    sourceType: "store-api" as const,
    price: normalized.price,
    regularPrice: normalized.regularPrice,
    currency: normalized.currency,
    countryCode: normalized.countryCode,
    discountPercent: normalized.discountPercent,
    drm: "DRM-free" as const,
    externalUrl: normalized.externalUrl,
    available: normalized.available
  };
}

async function fetchJson(url: URL, fetcher: Fetcher, options: { timeoutMs: number; maxRetries: number }): Promise<unknown> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= options.maxRetries) {
    assertRateLimit();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetcher(url, {
        headers: {
          accept: "application/json",
          "user-agent": "GameValue Radar GOG connector (personal hobby project; no scraping)"
        },
        signal: controller.signal
      });
      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.toLowerCase().includes("json")) {
        throw new GogConnectorError(
          `GOG returned ${contentType || "non-JSON"} instead of API JSON.`,
          bodyLooksLikeHtml(body) ? "invalid_response" : "invalid_response",
          response.status
        );
      }

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new GogConnectorError("GOG returned invalid JSON.", "invalid_response", response.status);
      }

      if (!response.ok) {
        throw new GogConnectorError(`GOG API responded with HTTP ${response.status}.`, "api_http_error", response.status);
      }

      return payload;
    } catch (error) {
      lastError = error;
      if (error instanceof GogConnectorError && error.errorType !== "api_http_error") {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new GogConnectorError("The GOG request timed out.", "timeout");
      }
      if (attempt >= options.maxRetries) {
        break;
      }
      attempt += 1;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof GogConnectorError) {
    throw lastError;
  }
  throw new GogConnectorError("The GOG request failed.", "network_error");
}

function assertRateLimit(): void {
  const now = Date.now();
  const limit = getGogRequestLimitPerHour();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > hourMs) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= limit) {
    throw new GogConnectorError(`GOG request limit reached (${limit}/hour). Try again later.`, "rate_limited");
  }
  requestTimestamps.push(now);
}

function moneyAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundMoney(value);
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

function discountPercent(value: unknown, price: number, regularPrice: number | null): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(Math.round(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return Math.abs(Math.round(parsed));
    }
  }
  if (regularPrice && regularPrice > price) {
    return Math.round(((regularPrice - price) / regularPrice) * 100);
  }
  return 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSlug(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bodyLooksLikeHtml(body: string): boolean {
  return /<html|<!doctype html|<title>/i.test(body);
}

function ensureEnabled(): void {
  if (!isGogEnabled()) {
    throw new GogConnectorError("GOG connector is disabled. Set GOG_ENABLED=true before calling GOG APIs.", "disabled");
  }
}

function safeLogText(value: string): string {
  return value.replace(/[<>]/g, "").slice(0, 180);
}

async function logGog(level: IntegrationLog["level"], message: string): Promise<void> {
  await repositories.diagnostics.recordIntegrationLog({ service: "gog", level, message });
}

export const gogService = new GogService();
