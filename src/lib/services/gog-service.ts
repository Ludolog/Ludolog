import {
  getCatalogPriceStaleHours,
  getGogApiBaseUrl,
  getGogCatalogBaseUrl,
  getGogCountryCode,
  getGogCurrency,
  getGogPriceStaleHours,
  getGogRequestLimitPerHour,
  getPriceRefreshMaxRuntimeMs,
  isGogEnabled
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import type { CatalogStoreOfferInput } from "@/lib/repositories/contracts";
import type {
  CatalogPriceCheckStatusValue,
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
import type {
  ApiGogCatalogDiscoverRequest,
  ApiGogCatalogDiscoverResponse,
  ApiGogCatalogProductType,
  ApiGogCatalogSuggestedMapping,
  ApiGogCatalogPriceBackfillRequest,
  ApiGogCatalogPriceBackfillResponse,
  ApiGogMappingSuggestResponse,
  ApiGogPricePreview,
  ApiGogPriceRefreshRequest,
  ApiGogPriceRefreshResponse
} from "@shared/api-types";

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
  configuredCurrency: string;
  returnedCurrency: string;
  currencyMismatch: boolean;
  currencyMessage: string | null;
  productType: ApiGogCatalogProductType;
  discountPercent: number;
  externalUrl: string;
  available: boolean;
  rawData: GogCatalogProduct;
};

type GogSuggestion = GogCatalogEntry & { confidence: GogMappingConfidence; reason: string; rejected?: boolean };
type GogDiscoveryTarget = { query: string; game: Game | null };

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

  async getCatalogProductForEntry(entry: GogCatalogEntry): Promise<GogCatalogProduct> {
    const rawProduct = catalogEntryRawProduct(entry);
    if (rawProduct && productHasUsablePrice(rawProduct)) {
      return rawProduct;
    }

    let metadataProduct: GogCatalogProduct | null = null;
    try {
      const metadata = await this.getProductMetadata(entry.gogProductId);
      metadataProduct = metadataToCatalogProduct(metadata, entry);
      if (metadataProduct && productHasUsablePrice(metadataProduct)) {
        return metadataProduct;
      }
    } catch (error) {
      if (!(error instanceof GogConnectorError && (error.errorType === "not_found" || error.httpStatus === 404))) {
        throw error;
      }
    }

    const query = entry.slug || entry.title || entry.gogProductId;
    const products = await this.catalogConnector.search(query, 20);
    const exact = products.find((product) => String(product.id) === entry.gogProductId);
    if (exact) {
      return exact;
    }

    const slug = normalizeSlug(entry.slug || query);
    const slugMatch = products.find((product) => normalizeSlug(product.slug) === slug && String(product.id) === entry.gogProductId);
    if (slugMatch) {
      return slugMatch;
    }

    if (rawProduct) {
      return rawProduct;
    }
    if (metadataProduct) {
      return metadataProduct;
    }
    throw new GogConnectorError(`GOG product ${entry.gogProductId} is unavailable in catalog price lookup.`, "not_found");
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
    const configuredCurrency = fallbackCurrency.toUpperCase();
    const returnedCurrency = String(product.price?.finalMoney?.currency ?? product.price?.baseMoney?.currency ?? configuredCurrency).toUpperCase();
    const currencyMismatch = returnedCurrency !== configuredCurrency;

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
      currency: returnedCurrency,
      countryCode,
      configuredCurrency,
      returnedCurrency,
      currencyMismatch,
      currencyMessage: currencyMismatch
        ? `GOG returned ${returnedCurrency} while ${configuredCurrency} is configured. Stored without FX conversion.`
        : null,
      productType: classifyGogProduct(product),
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
    const gameTokens = meaningfulTitleTokens(gameTitle);

    return entries.map((entry) => {
      const entryTitle = normalizeTitle(entry.title);
      const entrySlug = normalizeSlug(entry.slug);
      const weakProduct = isWeakGogProduct(entry);
      const productType = classifyGogCatalogEntry(entry);
      if (!weakProduct && productType !== "bundle" && (entrySlug === gameSlug || entryTitle === gameTitle)) {
        return { ...entry, confidence: "exact", reason: "Normalized title or slug is an exact match." };
      }

      const entryTokens = meaningfulTitleTokens(entryTitle);
      const overlap = tokenOverlap(gameTokens, entryTokens);
      const containsWholeGameTitle = containsTitlePhrase(entryTitle, gameTitle);

      if (!weakProduct && productType === "bundle" && containsWholeGameTitle && overlap >= 0.75) {
        return { ...entry, confidence: "title-match", reason: "Bundle or complete-edition candidate contains the game title. Manual review required." };
      }
      if (!weakProduct && containsWholeGameTitle && overlap >= 0.75) {
        return { ...entry, confidence: "title-match", reason: "Candidate title contains the full game title with strong token overlap." };
      }
      if (!weakProduct && overlap >= 0.85) {
        return { ...entry, confidence: "title-match", reason: "Candidate title has strong token overlap with the game title." };
      }
      return {
        ...entry,
        confidence: "unknown",
        rejected: true,
        reason: weakProduct
          ? "Rejected weak GOG candidate because it looks like DLC, soundtrack, demo, bonus content or a tool."
          : "Rejected weak fuzzy match because title tokens do not overlap enough."
      };
    });
  }
}

export class GogService {
  private readonly catalogConnector = new GogCatalogConnector();
  private readonly priceConnector = new GogPriceConnector({ catalogConnector: this.catalogConnector });
  private readonly normalizer = new GogPriceNormalizer();
  private readonly mapper = new GogProductMapper();

  async status() {
    const [repositoryStatus, logs, gogOfferCount, gogPriceSnapshotCount, lastGogPriceRefresh, catalogOfferStatus, catalogEntries] = await Promise.all([
      repositories.gog.status(),
      repositories.diagnostics.listIntegrationLogs(30),
      repositories.games.countOffersBySource("gog"),
      repositories.snapshots.countPriceSnapshotsBySource("gog"),
      latestGogPriceRefresh(),
      repositories.catalogOffers.status(new Date(Date.now() - getCatalogPriceStaleHours() * 60 * 60 * 1000), "gog"),
      repositories.gog.listCatalogEntries(500)
    ]);
    const gogLogs = logs.filter((log) => log.service === "gog");
    const now = new Date();
    const catalogStatuses = await repositories.catalogPriceChecks.findGogStatuses(
      "gog",
      catalogEntries.map((entry) => entry.gogProductId)
    );
    const activeCooldowns = catalogStatuses.filter((status) => status.nextCheckAt > now);

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
      gogCatalogOfferCount: catalogOfferStatus.providerCatalogStoreOfferCount ?? 0,
      gogStaleCatalogOfferCount: catalogOfferStatus.providerStaleCatalogStoreOfferCount ?? 0,
      gogNoPriceCooldownCount: activeCooldowns.filter((status) => status.status === "no-price").length,
      gogUnavailableCooldownCount: activeCooldowns.filter((status) => status.status === "unavailable").length,
      gogUnsupportedCooldownCount: activeCooldowns.filter((status) => status.status === "unsupported").length,
      gogErrorCooldownCount: activeCooldowns.filter((status) => status.status === "error").length,
      lastGogPriceRefresh,
      lastGogCatalogPriceRefresh: catalogOfferStatus.providerLastCatalogStoreOfferRefresh ?? null,
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

  async approveMapping(input: {
    gameId: string;
    gogProductId: string;
    externalSlug?: string | null;
    confidence?: GogMappingConfidence;
  }): Promise<GameExternalMapping> {
    const catalogEntry = input.externalSlug ? null : await repositories.gog.findCatalogByProductId(input.gogProductId);
    return this.upsertMapping({
      ...input,
      externalSlug: input.externalSlug ?? catalogEntry?.slug ?? null,
      confidence: input.confidence ?? "manual"
    });
  }

  async suggestMappings(input: { mode?: "imported-games"; limit?: number }): Promise<ApiGogMappingSuggestResponse> {
    ensureEnabled();
    const limit = clampPositive(input.limit ?? 20, 1, 50);
    const games = await repositories.games.listImported(limit);
    const exactMatches: ApiGogCatalogSuggestedMapping[] = [];
    const reviewRequired: ApiGogCatalogSuggestedMapping[] = [];
    const uncertain: ApiGogCatalogSuggestedMapping[] = [];
    const rejectedBadCandidates: ApiGogCatalogSuggestedMapping[] = [];
    const skipped: ApiGogMappingSuggestResponse["skipped"] = [];

    for (const game of games) {
      const existingMapping = await repositories.gog.findMappingByGameId(game.id);
      if (existingMapping) {
        skipped.push({
          gameId: game.id,
          steamAppId: game.steamAppId,
          title: game.title,
          reason: "GOG mapping already exists."
        });
        continue;
      }

      const search = await this.searchCatalog({ query: game.title, limit: 10 });
      const suggestions = this.mapper.suggest(game, search.results);
      if (suggestions.length === 0) {
        skipped.push({
          gameId: game.id,
          steamAppId: game.steamAppId,
          title: game.title,
          reason: "No GOG catalog candidates found."
        });
        continue;
      }

      for (const suggestion of suggestions) {
        const apiSuggestion = suggestionToApi(game, suggestion);
        if (suggestion.rejected) {
          rejectedBadCandidates.push(apiSuggestion);
        } else if (apiSuggestion.confidence === "exact") {
          exactMatches.push(apiSuggestion);
        } else if (apiSuggestion.confidence === "title-match") {
          reviewRequired.push(apiSuggestion);
        } else {
          uncertain.push(apiSuggestion);
        }
      }
    }

    await logGog(
      "info",
      `GOG mapping suggestions finished. mode=imported-games, games=${games.length}, exact=${exactMatches.length}, review=${reviewRequired.length}, uncertain=${uncertain.length}, rejected=${rejectedBadCandidates.length}, skipped=${skipped.length}.`
    );

    return {
      mode: "imported-games",
      exactMatches,
      reviewRequired,
      uncertain,
      rejectedBadCandidates,
      skipped
    };
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

  async discoverCatalog(input: ApiGogCatalogDiscoverRequest): Promise<ApiGogCatalogDiscoverResponse> {
    ensureEnabled();
    const limit = clampPositive(input.limit ?? 20, 1, 50);
    const mode = discoveryMode(input);
    const targets = await this.discoveryTargets(input, mode, limit);
    const seenProducts = new Set<string>();
    const seenSuggestions = new Set<string>();
    let createdCatalogEntries = 0;
    let updatedCatalogEntries = 0;
    const searchedQueries: string[] = [];
    const suggestedMappings: ApiGogCatalogSuggestedMapping[] = [];
    const uncertainMatches: ApiGogCatalogSuggestedMapping[] = [];

    for (const target of targets) {
      const query = target.query.trim();
      if (!query || searchedQueries.includes(query)) {
        continue;
      }
      searchedQueries.push(query);
      const search = await this.searchCatalog({ query, limit: Math.min(limit, 10) });
      createdCatalogEntries += search.upserted.created;
      updatedCatalogEntries += search.upserted.updated;
      for (const entry of search.results) {
        seenProducts.add(entry.gogProductId);
      }

      if (!target.game) {
        continue;
      }

      for (const suggestion of this.mapper.suggest(target.game, search.results)) {
        if (suggestion.rejected) {
          continue;
        }
        const apiSuggestion = suggestionToApi(target.game, suggestion);
        const suggestionKey = `${apiSuggestion.gameId}:${apiSuggestion.gogProductId}`;
        if (seenSuggestions.has(suggestionKey)) {
          continue;
        }
        seenSuggestions.add(suggestionKey);
        if (apiSuggestion.confidence === "unknown") {
          uncertainMatches.push(apiSuggestion);
        } else {
          suggestedMappings.push(apiSuggestion);
        }
      }
    }

    await logGog(
      "info",
      `GOG catalog discovery finished. mode=${mode}, queries=${searchedQueries.length}, products=${seenProducts.size}, suggested=${suggestedMappings.length}, uncertain=${uncertainMatches.length}.`
    );

    return {
      mode,
      searchedQueries,
      foundProducts: seenProducts.size,
      createdCatalogEntries,
      updatedCatalogEntries,
      suggestedMappings,
      uncertainMatches
    };
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
    const suggestions = this.mapper.suggest(game, search.results).filter((suggestion) => !suggestion.rejected);
    return { gameId: game.id, existingMapping: null, suggestions };
  }

  async testPrice(input: { gogProductId: string; externalSlug?: string | null; countryCode?: string; currency?: string }) {
    ensureEnabled();
    const connector = new GogPriceConnector({
      countryCode: input.countryCode ?? getGogCountryCode(),
      currency: input.currency ?? getGogCurrency()
    });
    const catalogEntry = await repositories.gog.findCatalogByProductId(input.gogProductId);
    const product = catalogEntry
      ? await connector.getCatalogProductForEntry(catalogEntry)
      : await connector.getCatalogProduct({
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

  async refreshPrices(input: ApiGogPriceRefreshRequest): Promise<ApiGogPriceRefreshResponse> {
    ensureEnabled();
    const started = Date.now();
    const startedAt = new Date(started);
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 10);
    const mappings = await this.mappingsForRefresh(input.gameIds, limit);
    const result: ApiGogPriceRefreshResponse = {
      provider: "gamevalue" as const,
      sourceName: "gog" as const,
      dryRun: input.dryRun ?? true,
      requested: mappings.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      skippedFreshCache: 0,
      skippedNoMapping: input.gameIds && input.gameIds.length > mappings.length ? input.gameIds.length - mappings.length : 0,
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      durationMs: 0,
      errors: [] as Array<{ gameId: string; gogProductId?: string; message: string }>,
      results: [] as Array<{
        gameId: string;
        gogProductId: string;
        refreshed: boolean;
        skipped: boolean;
        preview: ApiGogPricePreview | null;
        offerId: string | null;
        snapshotId: string | null;
        message: string | null;
      }>
    };
    const staleBefore = new Date(Date.now() - getGogPriceStaleHours() * 60 * 60 * 1000);

    for (const mapping of mappings) {
      if (Date.now() - started > getPriceRefreshMaxRuntimeMs()) {
        result.failed += 1;
        result.errors.push({ gameId: mapping.gameId, gogProductId: mapping.externalId, message: "GOG price refresh stopped at max runtime." });
        break;
      }
      try {
        if (mapping.confidence === "unknown") {
          result.skipped += 1;
          result.results.push({
            gameId: mapping.gameId,
            gogProductId: mapping.externalId,
            refreshed: false,
            skipped: true,
            preview: null,
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

        const latestGogSnapshot = (await repositories.snapshots.listPrices(game.id))
          .filter((snapshot) => snapshot.source === "gog")
          .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
        if (!result.dryRun && latestGogSnapshot && latestGogSnapshot.capturedAt >= staleBefore) {
          result.skipped += 1;
          result.skippedFreshCache = (result.skippedFreshCache ?? 0) + 1;
          result.results.push({
            gameId: game.id,
            gogProductId: mapping.externalId,
            refreshed: false,
            skipped: true,
            preview: null,
            offerId: null,
            snapshotId: null,
            message: "Skipped fresh GOG price cache."
          });
          continue;
        }

        const catalogEntry = await repositories.gog.findCatalogByProductId(mapping.externalId);
        const product = catalogEntry
          ? await this.priceConnector.getCatalogProductForEntry(catalogEntry)
          : await this.priceConnector.getCatalogProduct({
              gogProductId: mapping.externalId,
              externalSlug: mapping.externalSlug,
              title: game.title
            });
        const normalized = this.normalizer.normalize(product);
        const preview = normalizedToPreview(normalized);
        if (result.dryRun) {
          result.skipped += 1;
          result.results.push({
            gameId: game.id,
            gogProductId: mapping.externalId,
            refreshed: false,
            skipped: true,
            preview,
            offerId: null,
            snapshotId: null,
            message: "Dry run only; no GOG price data was written."
          });
          continue;
        }

        const write = await this.writePrice(game, mapping, normalized);
        result.refreshed += 1;
        result.results.push({
          gameId: game.id,
          gogProductId: mapping.externalId,
          refreshed: true,
          skipped: false,
          preview,
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
          preview: null,
          offerId: null,
          snapshotId: null,
          message
        });
        await logGog("warning", `GOG price refresh failed. gameId=${mapping.gameId}, gogProductId=${mapping.externalId}, message=${safeLogText(message)}.`);
      }
    }

    const finishedAt = new Date();
    result.finishedAt = finishedAt.toISOString();
    result.durationMs = finishedAt.getTime() - startedAt.getTime();

    await logGog(
      result.failed > 0 ? "warning" : "info",
      `GOG price refresh finished. dryRun=${result.dryRun}, requested=${result.requested}, refreshed=${result.refreshed}, skipped=${result.skipped}, skippedFreshCache=${result.skippedFreshCache ?? 0}, failed=${result.failed}, durationMs=${result.durationMs}.`
    );

    return result;
  }

  async fetchPriceForCatalogEntry(entry: GogCatalogEntry): Promise<NormalizedGogPrice> {
    const product = await this.priceConnector.getCatalogProductForEntry(entry);
    return this.normalizer.normalize(product);
  }

  async backfillCatalogPrices(input: ApiGogCatalogPriceBackfillRequest): Promise<ApiGogCatalogPriceBackfillResponse> {
    ensureEnabled();
    const started = Date.now();
    const startedAt = new Date(started);
    const limit = clampPositive(input.limit ?? 10, 1, 25);
    const requestedProductIds = input.gogProductIds?.slice(0, limit) ?? null;
    const fetchedEntries =
      requestedProductIds && requestedProductIds.length > 0
        ? await repositories.gog.findCatalogByProductIds(requestedProductIds)
        : await repositories.gog.listCatalogEntries(Math.max(limit * 5, limit));
    const entriesByProductId = new Map(fetchedEntries.map((entry) => [entry.gogProductId, entry]));
    const entries =
      requestedProductIds && requestedProductIds.length > 0
        ? requestedProductIds.map((gogProductId) => entriesByProductId.get(gogProductId)).filter((entry): entry is GogCatalogEntry => entry !== undefined)
        : fetchedEntries;
    const missingProductIds = requestedProductIds?.filter((gogProductId) => !entriesByProductId.has(gogProductId)) ?? [];
    const statuses = new Map(
      (await repositories.catalogPriceChecks.findGogStatuses("gog", entries.map((entry) => entry.gogProductId))).map((status) => [
        status.gogProductId,
        status
      ])
    );
    const result: ApiGogCatalogPriceBackfillResponse = {
      provider: "gamevalue",
      sourceName: "gog",
      dryRun: input.dryRun ?? true,
      requested: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      createdOffers: 0,
      updatedOffers: 0,
      skippedNoPrice: 0,
      skippedUnsupported: 0,
      skippedFreshCache: 0,
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      durationMs: 0,
      errors: [],
      warnings: [],
      results: []
    };

    for (const gogProductId of missingProductIds) {
      if (result.requested >= limit) {
        break;
      }
      result.requested += 1;
      const message = `GOG catalog entry ${gogProductId} is not stored locally. Run catalog search/discovery before price backfill.`;
      const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      result.skipped += 1;
      result.skippedNoPrice += 1;
      result.warnings.push({
        gogProductId,
        title: null,
        status: "unavailable",
        nextCheckAt: nextCheckAt.toISOString(),
        message
      });
      if (!result.dryRun) {
        await this.markCatalogPriceCheck({
          gogProductId,
          status: "unavailable",
          checkedAt: new Date(),
          nextCheckAt,
          message
        });
      }
      result.results.push({
        gogProductId,
        title: null,
        refreshed: false,
        skipped: true,
        preview: null,
        offerId: null,
        message,
        status: "unavailable",
        nextCheckAt: nextCheckAt.toISOString()
      });
    }

    for (const entry of entries) {
      if (result.requested >= limit) {
        break;
      }
      result.requested += 1;
      if (Date.now() - started > getPriceRefreshMaxRuntimeMs()) {
        const message = "GOG catalog price backfill stopped at max runtime.";
        result.failed += 1;
        result.errors.push({ gogProductId: entry.gogProductId, message });
        break;
      }

      const productType = classifyGogCatalogEntry(entry);
      const unsupportedMessage = unsupportedGogProductMessage(productType, input);
      if (unsupportedMessage) {
        const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        result.skipped += 1;
        result.skippedUnsupported += 1;
        result.warnings.push({
          gogProductId: entry.gogProductId,
          title: entry.title,
          status: "unsupported",
          productType,
          nextCheckAt: nextCheckAt.toISOString(),
          message: unsupportedMessage
        });
        if (!result.dryRun) {
          await this.markCatalogPriceCheck({
            gogProductId: entry.gogProductId,
            status: "unsupported",
            checkedAt: new Date(),
            nextCheckAt,
            message: unsupportedMessage
          });
        }
        result.results.push({
          gogProductId: entry.gogProductId,
          title: entry.title,
          refreshed: false,
          skipped: true,
          preview: null,
          offerId: null,
          message: unsupportedMessage,
          status: "unsupported",
          productType,
          nextCheckAt: nextCheckAt.toISOString()
        });
        continue;
      }

      const cachedStatus = statuses.get(entry.gogProductId);
      if (cachedStatus && cachedStatus.nextCheckAt > new Date()) {
        const message = `Skipped active GOG catalog price cooldown: ${cachedStatus.status}.`;
        result.skipped += 1;
        result.skippedFreshCache += 1;
        result.warnings.push({
          gogProductId: entry.gogProductId,
          title: entry.title,
          status: "fresh-cache",
          productType,
          nextCheckAt: cachedStatus.nextCheckAt.toISOString(),
          message
        });
        result.results.push({
          gogProductId: entry.gogProductId,
          title: entry.title,
          refreshed: false,
          skipped: true,
          preview: null,
          offerId: null,
          message,
          status: "fresh-cache",
          productType,
          nextCheckAt: cachedStatus.nextCheckAt.toISOString()
        });
        continue;
      }

      try {
        const normalized = await this.fetchPriceForCatalogEntry(entry);
        const preview = normalizedToPreview(normalized);
        if (preview.currencyMismatch) {
          result.warnings.push({
            gogProductId: entry.gogProductId,
            title: entry.title,
            status: "currency-mismatch",
            productType: preview.productType,
            message: preview.currencyMessage ?? "GOG returned a currency different from the configured currency."
          });
        }
        if (result.dryRun) {
          result.skipped += 1;
          result.results.push({
            gogProductId: entry.gogProductId,
            title: entry.title,
            refreshed: false,
            skipped: true,
            preview,
            offerId: null,
            message: "Dry run only; no catalog GOG price data was written.",
            status: "dry-run",
            productType: preview.productType
          });
          continue;
        }

        const written = await repositories.catalogOffers.upsert(buildCatalogGogStoreOffer(entry, normalized));
        await this.markCatalogPriceCheck({
          gogProductId: entry.gogProductId,
          status: "available",
          checkedAt: new Date(),
          message: null
        });
        result.refreshed += 1;
        result.createdOffers += written.created ? 1 : 0;
        result.updatedOffers += written.created ? 0 : 1;
        result.results.push({
          gogProductId: entry.gogProductId,
          title: entry.title,
          refreshed: true,
          skipped: false,
          preview,
          offerId: written.offer.id,
          message: null,
          status: "refreshed",
          productType: preview.productType
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown GOG catalog price backfill error.";
        if (error instanceof GogConnectorError && error.errorType === "no_price_data") {
          const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          result.skipped += 1;
          result.skippedNoPrice += 1;
          result.warnings.push({
            gogProductId: entry.gogProductId,
            title: entry.title,
            status: "no-price",
            productType,
            nextCheckAt: nextCheckAt.toISOString(),
            message
          });
          if (!result.dryRun) {
            await this.markCatalogPriceCheck({
              gogProductId: entry.gogProductId,
              status: "no-price",
              checkedAt: new Date(),
              nextCheckAt,
              message
            });
          }
          result.results.push({
            gogProductId: entry.gogProductId,
            title: entry.title,
            refreshed: false,
            skipped: true,
            preview: null,
            offerId: null,
            message,
            status: "no-price",
            productType,
            nextCheckAt: nextCheckAt.toISOString()
          });
          continue;
        }
        if (error instanceof GogConnectorError && error.errorType === "not_found") {
          const nextCheckAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          result.skipped += 1;
          result.skippedNoPrice += 1;
          result.warnings.push({
            gogProductId: entry.gogProductId,
            title: entry.title,
            status: "unavailable",
            productType,
            nextCheckAt: nextCheckAt.toISOString(),
            message
          });
          if (!result.dryRun) {
            await this.markCatalogPriceCheck({
              gogProductId: entry.gogProductId,
              status: "unavailable",
              checkedAt: new Date(),
              nextCheckAt,
              message
            });
          }
          result.results.push({
            gogProductId: entry.gogProductId,
            title: entry.title,
            refreshed: false,
            skipped: true,
            preview: null,
            offerId: null,
            message,
            status: "unavailable",
            productType,
            nextCheckAt: nextCheckAt.toISOString()
          });
          continue;
        }
        result.failed += 1;
        result.errors.push({ gogProductId: entry.gogProductId, message });
        if (!result.dryRun) {
          await this.markCatalogPriceCheck({
            gogProductId: entry.gogProductId,
            status: "error",
            checkedAt: new Date(),
            message
          });
        }
        result.results.push({
          gogProductId: entry.gogProductId,
          title: entry.title,
          refreshed: false,
          skipped: false,
          preview: null,
          offerId: null,
          message,
          status: "error",
          productType
        });
        await logGog("warning", `GOG catalog price backfill failed. gogProductId=${entry.gogProductId}, message=${safeLogText(message)}.`);
      }
    }

    const finishedAt = new Date();
    result.finishedAt = finishedAt.toISOString();
    result.durationMs = finishedAt.getTime() - startedAt.getTime();

    await logGog(
      result.failed > 0 ? "warning" : "info",
      `GOG catalog price backfill finished. dryRun=${result.dryRun}, requested=${result.requested}, refreshed=${result.refreshed}, skipped=${result.skipped}, skippedNoPrice=${result.skippedNoPrice}, skippedUnsupported=${result.skippedUnsupported}, skippedFreshCache=${result.skippedFreshCache}, failed=${result.failed}, durationMs=${result.durationMs}.`
    );

    return result;
  }

  private async markCatalogPriceCheck(input: {
    gogProductId: string;
    status: Extract<CatalogPriceCheckStatusValue, "available" | "no-price" | "unavailable" | "unsupported" | "error">;
    checkedAt: Date;
    nextCheckAt?: Date;
    message: string | null;
  }): Promise<void> {
    const nextCheckAt =
      input.nextCheckAt ??
      new Date(
        input.checkedAt.getTime() +
          (input.status === "available"
            ? getGogPriceStaleHours() * 60 * 60 * 1000
            : input.status === "error"
              ? 6 * 60 * 60 * 1000
              : 7 * 24 * 60 * 60 * 1000)
      );
    await repositories.catalogPriceChecks.upsert({
      sourceName: "gog",
      steamAppId: null,
      gogProductId: input.gogProductId,
      status: input.status,
      lastCheckedAt: input.checkedAt,
      nextCheckAt,
      lastError: input.message
    });
  }

  private async discoveryTargets(
    input: ApiGogCatalogDiscoverRequest,
    mode: ApiGogCatalogDiscoverResponse["mode"],
    limit: number
  ): Promise<GogDiscoveryTarget[]> {
    if (mode === "queries" && "queries" in input) {
      return uniqueStrings(input.queries ?? [])
        .slice(0, limit)
        .map((query) => ({ query, game: null }));
    }

    if (mode === "top-steam-catalog") {
      const summaries = await repositories.games.mostActive(limit);
      return summaries.map((summary) => ({ query: summary.game.title, game: summary.game }));
    }

    const games = await repositories.games.listImported(limit);
    return games.map((game) => ({ query: game.title, game }));
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

function buildCatalogGogStoreOffer(entry: GogCatalogEntry, normalized: NormalizedGogPrice): CatalogStoreOfferInput {
  const now = new Date();
  return {
    id: `catalog-offer-gog-${normalized.gogProductId}`,
    steamAppId: null,
    gogProductId: normalized.gogProductId,
    catalogSource: "gog",
    gameId: null,
    provider: "gog",
    storeName: "GOG",
    storeType: "official",
    title: normalized.title || entry.title,
    price: normalized.price,
    regularPrice: normalized.regularPrice,
    currency: normalized.currency,
    discountPercent: normalized.discountPercent,
    externalUrl: normalized.externalUrl,
    countryCode: normalized.countryCode,
    available: normalized.available,
    drm: "DRM-free",
    sourceRawId: normalized.gogProductId,
    rawProviderData: {
      gogProductId: normalized.gogProductId,
      fetchedAt: now.toISOString(),
      productType: normalized.productType,
      slug: normalized.slug,
      configuredCurrency: normalized.configuredCurrency,
      returnedCurrency: normalized.returnedCurrency,
      currencyMismatch: normalized.currencyMismatch,
      currencyMessage: normalized.currencyMessage
    },
    fetchedAt: now
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

function catalogEntryRawProduct(entry: GogCatalogEntry): GogCatalogProduct | null {
  if (!isRecord(entry.rawData)) {
    return null;
  }
  return {
    ...entry.rawData,
    id: entry.gogProductId,
    title: typeof entry.rawData.title === "string" ? entry.rawData.title : entry.title,
    slug: typeof entry.rawData.slug === "string" ? entry.rawData.slug : entry.slug,
    productType: typeof entry.rawData.productType === "string" ? entry.rawData.productType : entry.productType ?? undefined,
    storeLink:
      typeof entry.rawData.storeLink === "string"
        ? entry.rawData.storeLink
        : typeof entry.url === "string"
          ? entry.url
          : `https://www.gog.com/game/${entry.slug}`
  } as GogCatalogProduct;
}

function metadataToCatalogProduct(metadata: GogProductResponse, entry: GogCatalogEntry): GogCatalogProduct | null {
  if (!isRecord(metadata)) {
    return null;
  }
  return {
    ...metadata,
    id: metadata.id ?? entry.gogProductId,
    title: metadata.title ?? entry.title,
    slug: metadata.slug ?? entry.slug,
    productType: typeof metadata.productType === "string" ? metadata.productType : entry.productType ?? undefined,
    storeLink: metadata.links?.product_card ?? metadata.links?.purchase_link ?? entry.url ?? `https://www.gog.com/game/${entry.slug}`
  };
}

function productHasUsablePrice(product: GogCatalogProduct): boolean {
  return moneyAmount(product.price?.finalMoney?.amount) !== null;
}

function classifyGogCatalogEntry(entry: GogCatalogEntry): ApiGogCatalogProductType {
  const rawProduct = catalogEntryRawProduct(entry);
  return classifyGogProduct(
    rawProduct
      ? { ...rawProduct, id: entry.gogProductId, title: rawProduct.title ?? entry.title, slug: rawProduct.slug ?? entry.slug }
      : { id: entry.gogProductId, title: entry.title, slug: entry.slug, productType: entry.productType ?? undefined }
  );
}

function classifyGogProduct(product: GogCatalogProduct): ApiGogCatalogProductType {
  const titleText = `${normalizeTitle(product.title)} ${normalizeSlug(product.slug).replace(/-/g, " ")}`;
  const productTypeText = String(product.productType ?? "").toLowerCase();
  const text = `${titleText} ${productTypeText}`;
  if (hasAnyTerm(text, ["soundtrack", "ost"])) {
    return "soundtrack";
  }
  if (hasAnyTerm(text, ["demo", "trial"])) {
    return "demo";
  }
  if (hasAnyTerm(text, ["dedicated server", "server", "sdk", "tool", "editor"])) {
    return "tool";
  }
  if (
    hasAnyTerm(text, [
      " dlc ",
      "expansion",
      "expansion pass",
      "season pass",
      "hearts of stone",
      "blood and wine",
      "pakiet dodatkow",
      "pakiet dodatk",
      "dodatek"
    ])
  ) {
    return "dlc";
  }
  if (hasAnyTerm(titleText, ["bundle", "complete edition", "goty", "game of the year", "collection", " pack "])) {
    return "bundle";
  }
  if (productTypeText === "game") {
    return "baseGame";
  }
  return "unknown";
}

function unsupportedGogProductMessage(
  productType: ApiGogCatalogProductType,
  input: ApiGogCatalogPriceBackfillRequest
): string | null {
  if (productType === "dlc") {
    return input.includeDlc ? null : "Skipped GOG catalog product because it looks like DLC or an expansion.";
  }
  if (productType === "soundtrack") {
    return input.includeSoundtracks ? null : "Skipped GOG catalog product because it looks like a soundtrack.";
  }
  if (productType === "bundle") {
    return input.includeBundles ? null : "Skipped GOG catalog product because it looks like a bundle or complete edition.";
  }
  if (productType === "demo" || productType === "tool") {
    return `Skipped GOG catalog product because it looks like a ${productType}.`;
  }
  return null;
}

function hasAnyTerm(text: string, terms: string[]): boolean {
  const padded = ` ${text} `;
  return terms.some((term) => padded.includes(term));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedToPreview(normalized: NormalizedGogPrice): ApiGogPricePreview {
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
    configuredCurrency: normalized.configuredCurrency,
    returnedCurrency: normalized.returnedCurrency,
    currencyMismatch: normalized.currencyMismatch,
    currencyMessage: normalized.currencyMessage,
    productType: normalized.productType,
    discountPercent: normalized.discountPercent,
    drm: "DRM-free" as const,
    externalUrl: normalized.externalUrl,
    available: normalized.available
  };
}

function discoveryMode(input: ApiGogCatalogDiscoverRequest): ApiGogCatalogDiscoverResponse["mode"] {
  if ("queries" in input && input.queries?.length) {
    return "queries";
  }
  if ("mode" in input && input.mode) {
    return input.mode;
  }
  return "imported-games";
}

function suggestionToApi(game: Game, suggestion: GogSuggestion): ApiGogCatalogSuggestedMapping {
  return {
    gameId: game.id,
    steamAppId: game.steamAppId,
    gameTitle: game.title,
    gogProductId: suggestion.gogProductId,
    gogTitle: suggestion.title,
    externalSlug: suggestion.slug,
    confidence: suggestion.confidence,
    reason: suggestion.reason
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (normalized && !seen.has(key)) {
      seen.add(key);
      unique.push(normalized);
    }
  }
  return unique;
}

function clampPositive(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
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
  return cleanText(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSlug(value: string | null | undefined): string {
  return cleanText(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value: string): string {
  return value
    .replace(/\u00c3\u0082\u00c2\u00ae|\u00c2\u00ae|\u00ae/g, "")
    .replace(/\u00c3\u00a2\u00e2\u0082\u00ac\u00c5\u00be\u00c2\u00a2|\u00e2\u0084\u00a2|\u00c2\u2122|\u2122/g, "")
    .replace(/\u00c3\u0082\u00c2\u00a9|\u00c2\u00a9|\u00a9/g, "")
    .replace(/\u00c3\u00a2\u00e2\u0082\u00ac\u00e2\u0084\u00a2|\u00e2\u0080\u0099|\u00c2\u00b4|`/g, "'")
    .replace(/\u00c3\u00a2\u00e2\u0082\u00ac\u00c5\u0093|\u00c3\u00a2\u00e2\u0082\u00ac\u00c2\u009d|\u00e2\u0080\u009c|\u00e2\u0080\u009d/g, '"')
    .replace(/\u00c2/g, "");
}

function meaningfulTitleTokens(normalizedTitle: string): string[] {
  const stopWords = new Set(["the", "a", "an", "and", "of", "edition", "complete", "game", "goty"]);
  return normalizedTitle
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !stopWords.has(token));
}

function tokenOverlap(gameTokens: string[], entryTokens: string[]): number {
  if (gameTokens.length === 0 || entryTokens.length === 0) {
    return 0;
  }
  const entrySet = new Set(entryTokens);
  const matches = gameTokens.filter((token) => entrySet.has(token)).length;
  return matches / gameTokens.length;
}

function containsTitlePhrase(entryTitle: string, gameTitle: string): boolean {
  if (!gameTitle) {
    return false;
  }
  return ` ${entryTitle} `.includes(` ${gameTitle} `);
}

function isWeakGogProduct(entry: GogCatalogEntry): boolean {
  const productType = classifyGogCatalogEntry(entry);
  if (["dlc", "soundtrack", "demo", "tool"].includes(productType)) {
    return true;
  }
  const text = `${normalizeTitle(entry.title)} ${normalizeSlug(entry.slug).replace(/-/g, " ")} ${entry.productType ?? ""}`.toLowerCase();
  return ["artbook", "wallpaper", "bonus", "trailer"].some((term) => text.includes(term));
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
