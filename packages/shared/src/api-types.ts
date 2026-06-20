export type DateString = string;

export type DataMode = "mock" | "api";

export type StatsDataMode = "real" | "mixed" | "mock";

export type DataSource = "mock" | "steam-api" | "steam-store" | "price-api" | "prisma" | "ggdeals" | "manual" | "gog";

export type ApiPriceDataSource = DataSource | "none";

export type PriceProviderName = "gamevalue" | "mock" | "ggdeals" | "itad" | "cheapshark" | "gog" | "steam-store";

export type PriceMode = "internal" | "mock" | "api";

export type StoreType = "official" | "keyshop" | "marketplace" | "unknown";

export type Recommendation = "buy_now" | "wait" | "weak_deal";

export type PriceSourceType = "manual" | "csv" | "json" | "partner" | "mock" | "store-api" | "store-api-experimental";

export type PriceSourceConfidence =
  | "internal-real"
  | "experimental-store-api"
  | "internal-mock"
  | "external-legacy"
  | "no-price-data";

export type ApiPriceSource = {
  id: string;
  name: string;
  type: PriceSourceType;
  isActive: boolean;
  createdAt: DateString;
  updatedAt: DateString;
};

export type ApiStore = {
  id: string;
  name: string;
  slug: string;
  storeType: StoreType;
  websiteUrl: string | null;
  isActive: boolean;
  createdAt: DateString;
  updatedAt: DateString;
};

export type GGDealsProviderStatus =
  | "ok"
  | "not_configured"
  | "missing_key"
  | "blocked_by_cloudflare"
  | "invalid_key"
  | "invalid_response"
  | "no_price_data"
  | "network_error"
  | "timeout"
  | "api_error";

export type GGDealsErrorType =
  | "missing_api_key"
  | "blocked_by_cloudflare"
  | "invalid_api_key"
  | "invalid_json_response"
  | "no_price_data"
  | "network_error"
  | "timeout"
  | "api_http_error";

export type ApiGame = {
  id: string;
  steamAppId: number;
  title: string;
  slug: string;
  platform: string;
  description: string;
  coverUrl: string;
  genres: string[];
  developer: string;
  publisher: string;
  releaseDate: DateString;
  reviewScore: number;
  source: DataSource;
  createdAt: DateString;
  updatedAt: DateString;
};

export type ApiStoreOffer = {
  id: string;
  gameId: string;
  steamAppId: number | null;
  storeId: string | null;
  sourceId: string | null;
  provider: PriceProviderName | string;
  storeName: string;
  storeType: StoreType;
  title: string | null;
  price: number;
  regularPrice: number | null;
  historicalLow: number | null;
  currency: string;
  discountPercent: number;
  url: string;
  externalUrl: string | null;
  region: string;
  isOfficial: boolean;
  isOfficialStore: boolean;
  isHistoricalLow: boolean;
  available: boolean;
  drm: string;
  platform: string;
  sourceRawId: string | null;
  fetchedAt: DateString | null;
  createdAt: DateString;
  updatedAt: DateString;
  source: DataSource;
  sourceConfidence: PriceSourceConfidence;
  sourceName?: string | null;
  sourceType?: PriceSourceType | null;
};

export type PriceFreshness = "fresh" | "stale" | "no-data";

export type ApiCatalogStoreOffer = {
  id: string;
  steamAppId: number | null;
  gogProductId: string | null;
  catalogSource: "steam" | "gog" | string;
  gameId: string | null;
  provider: PriceProviderName | string;
  storeName: string;
  storeType: StoreType;
  title: string | null;
  price: number;
  regularPrice: number | null;
  currency: string;
  discountPercent: number;
  externalUrl: string | null;
  countryCode: string;
  available: boolean;
  drm: string;
  sourceRawId: string | null;
  fetchedAt: DateString;
  updatedAt: DateString;
  sourceConfidence: PriceSourceConfidence;
  sourceName: string | null;
  freshness: PriceFreshness;
};

export type ApiGamePriceSnapshot = {
  id: string;
  gameId: string;
  steamAppId: number | null;
  sourceId: string | null;
  provider: PriceProviderName | string;
  storeType: StoreType;
  price: number;
  bestPrice: number;
  historicalLow: number;
  basePrice: number;
  discountPercent: number;
  storeName: string;
  currency: string;
  externalUrl: string | null;
  offerCount: number;
  isHistoricalLow: boolean;
  sourceRawId: string | null;
  fetchedAt: DateString | null;
  capturedAt: DateString;
  createdAt: DateString;
  source: DataSource;
  sourceConfidence: PriceSourceConfidence;
  sourceName?: string | null;
  sourceType?: PriceSourceType | null;
};

export type ApiPlayerCountSnapshot = {
  id: string;
  gameId: string;
  steamAppId: number;
  playersOnline: number;
  capturedAt: DateString;
  source: DataSource;
};

export type ScoreFactors = {
  pricePosition: number;
  discountQuality: number;
  activity: number;
  trend: number;
  offerAvailability: number;
};

export type GameValueResult = {
  score: number;
  recommendation: Recommendation;
  factors: ScoreFactors;
  reason: string;
};

export type ApiGameSummary = {
  game: ApiGame;
  latestPrice: ApiGamePriceSnapshot | null;
  latestPlayers: ApiPlayerCountSnapshot | null;
  bestOffer: ApiStoreOffer | null;
  score: GameValueResult;
};

export type ApiGameSearchResult = {
  kind: "library" | "catalog";
  importable: boolean;
  source: "database" | "steam-catalog" | "mock-catalog";
  game: ApiGame;
  summary: ApiGameSummary | null;
  currentPlayers: number;
  currentPrice: number;
  historicalLow: number;
  catalogOffer?: ApiCatalogStoreOffer | null;
  lastUpdatedAt?: DateString | null;
  freshness?: PriceFreshness;
  nextRefreshAt?: DateString | null;
  dataSource?: ApiPriceDataSource;
  confidence?: PriceSourceConfidence;
  tags: string[];
};

export type ApiImportGameRequest = {
  steamAppId?: number;
  slug?: string;
  query?: string;
};

export type ApiImportGameSource = "library" | "steam-catalog" | "mock-catalog";

export type ApiImportGameResponse = {
  imported: boolean;
  created: boolean;
  source: ApiImportGameSource;
  steamAppId: number;
  gameId: string;
  summary: ApiGameSummary;
};

export type ApiStatsGame = {
  id: string;
  steamAppId: number;
  title: string;
  coverUrl: string;
  currentPlayers: number;
  playerTrendPercent: number;
  currentPrice: number;
  bestPrice: number | null;
  historicalLow: number;
  discountPercent: number;
  gameValueScore: number;
  recommendation: Recommendation;
  playerSource: DataSource;
  priceSource: ApiPriceDataSource;
  priceSourceConfidence: PriceSourceConfidence;
  priceConfidence: PriceSourceConfidence;
  priceExternalUrl: string | null;
  storeName: string | null;
  freshness: "fresh" | "stale" | "missing";
  categories: string[];
  tags: string[];
};

export type ApiCategoryType = "genre" | "trend" | "price" | "data-source" | "system";

export type ApiCategorySummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ApiCategoryType;
  gameCount: number;
  topGames: ApiStatsGame[];
  updatedAt: DateString;
};

export type ApiCategoryDetails = ApiCategorySummary & {
  games: ApiStatsGame[];
};

export type ApiStatsCategory = ApiCategoryDetails;

export type ApiCategoriesOverview = {
  categories: ApiCategorySummary[];
  updatedAt: DateString;
};

export type ApiStatsOverview = {
  topPlayers: ApiStatsGame[];
  trending: ApiStatsGame[];
  trendingUp: ApiStatsGame[];
  trendingDown: ApiStatsGame[];
  biggestGrowth: ApiStatsGame[];
  biggestDrop: ApiStatsGame[];
  bestValue: ApiStatsGame[];
  freeToPlay: ApiStatsGame[];
  trackedDeals: ApiStatsGame[];
  popularWatchlists: ApiStatsGame[];
  hiddenGems: ApiStatsGame[];
  categories: ApiStatsCategory[];
  dataFreshness: {
    latestSteamCatalogSync: DateString | null;
    latestPlayerCountRefresh: DateString | null;
    latestPriceRefresh: DateString | null;
  };
  sourceCounts: {
    importedGames: number;
    steamCatalogEntries: number;
    realInternalPriceSnapshots: number;
    realPriceSnapshots: number;
    mockPriceSnapshots: number;
    realOffers: number;
    mockOffers: number;
    realPlayerSnapshots: number;
    mockPlayerSnapshots: number;
    gogOffers: number;
    steamStoreOffers: number;
    catalogStoreOffers: number;
    manualOffers: number;
    gamesWithoutPrices: number;
    stalePlayerSnapshots: number;
    gamesWithoutPlayerData: number;
  };
  missingDataHints: string[];
  updatedAt: DateString;
  mode: StatsDataMode;
  ggdealsStatus: GGDealsProviderStatus;
  priceProvider: PriceProviderName;
  priceMode: PriceMode;
};

export type ApiGameProfile = ApiGameSummary & {
  priceHistory: ApiGamePriceSnapshot[];
  playerHistory: ApiPlayerCountSnapshot[];
  offers: ApiStoreOffer[];
  historicalLow: number | null;
  priceDeltaPercent: number | null;
};

export type ApiWatchlistItem = {
  id: string;
  userId: string;
  gameId: string;
  targetPrice: number | null;
  alertEnabled: boolean;
  createdAt: DateString;
  summary: ApiGameSummary | null;
};

export type ApiIntegrationLog = {
  id: string;
  service: "steam" | "steam-store" | "ggdeals" | "gog" | "price" | "price-cleanup" | "search" | "snapshot" | "alerts";
  level: "info" | "warning" | "error";
  message: string;
  createdAt: DateString;
};

export type ApiSteamCatalogStatus = {
  steamCatalogEntryCount: number;
  activeGameCount: number;
  catalogCompleteness: "partial" | "full" | "unknown";
  fetchedTotal: number;
  lastSteamCatalogSync: DateString | null;
  nextSteamCatalogStartAfterAppId: number | null;
  lastSteamCatalogError: ApiIntegrationLog | null;
  hasSteamApiKey: boolean;
  dataMode: DataMode;
  canUseRealSteamApi: boolean;
  integrationLogs: ApiIntegrationLog[];
};

export type ApiSteamCatalogSyncUntilRequest = {
  targetCount: number;
  batchSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
};

export type ApiSteamCatalogSyncUntilBatch = {
  batch: number;
  dryRun: boolean;
  fetched: number;
  created: number;
  updated: number;
  pages: number;
  lastAppId: number | null;
  hasMore: boolean;
  source: "steam-api" | "mock-fallback";
  countAfterBatch: number;
};

export type ApiSteamCatalogSyncUntilResponse = {
  dryRun: boolean;
  targetCount: number;
  initialCount: number;
  finalCount: number;
  estimatedFinalCount: number;
  batchSize: number;
  maxBatches: number;
  batchesRun: number;
  fetched: number;
  created: number;
  updated: number;
  completed: boolean;
  reason: "target-reached" | "max-batches-reached" | "steam-end-reached" | "no-progress" | "mock-fallback";
  lastAppId: number | null;
  hasMore: boolean;
  batches: ApiSteamCatalogSyncUntilBatch[];
};

export type ApiAdminStatus = {
  mode: DataMode;
  gameCount: number;
  steamCatalogEntryCount: number;
  importedGameCount: number;
  lastSteamCatalogSync: DateString | null;
  lastPlayerCountRefresh: DateString | null;
  offerCount: number;
  priceSnapshotCount: number;
  storeCount: number;
  priceSourceCount: number;
  playerSnapshotCount: number;
  watchlistCount: number;
  alertCount: number;
  priceProvider: PriceProviderName;
  priceMode: PriceMode;
  hasGGDealsApiKey: boolean;
  ggdealsStatus: GGDealsProviderStatus;
  lastGGDealsCheck: DateString | null;
  lastPriceRefresh: DateString | null;
  realInternalPriceSnapshots: number;
  realPriceSnapshots: number;
  mockPriceSnapshots: number;
  realOffers: number;
  mockOffers: number;
  gogEnabled: boolean;
  gogCatalogEntries: number;
  gogMappings: number;
  gogMappedGames: number;
  gogOfferCount: number;
  gogPriceSnapshotCount: number;
  lastGogSync: DateString | null;
  lastGogCatalogSearch: DateString | null;
  lastGogError: ApiIntegrationLog | null;
  lastGogPriceRefresh: DateString | null;
  gogCountryCode: string;
  gogCurrency: string;
  gogStatusMessage: string | null;
  steamStorePriceEnabled: boolean;
  steamStoreCountryCode: string;
  steamStoreCurrency: string;
  steamStoreMaxPerRun: number;
  steamStoreCacheTtlMinutes: number;
  steamStoreOfferCount: number;
  steamStorePriceSnapshotCount: number;
  catalogStoreOfferCount: number;
  lastSteamStorePriceRefresh: DateString | null;
  lastSteamStorePriceError: ApiIntegrationLog | null;
  realPlayerSnapshots: number;
  mockPlayerSnapshots: number;
  integrationLogs: ApiIntegrationLog[];
};

export type ApiPricesStatus = {
  provider: PriceProviderName;
  mode: PriceMode;
  externalProvidersEnabled: boolean;
  offerCount: number;
  priceSnapshotCount: number;
  storeCount: number;
  priceSourceCount: number;
  lastPriceSnapshot: DateString | null;
  realInternalPriceSnapshots: number;
  mockPriceSnapshots: number;
  realOffers: number;
  mockOffers: number;
  steamStoreOfferCount: number;
  steamStorePriceSnapshotCount: number;
  catalogStoreOfferCount: number;
};

export type ApiGogMappingConfidence = "exact" | "title-match" | "manual" | "unknown";

export type ApiGogCatalogEntry = {
  id: string;
  gogProductId: string;
  title: string;
  slug: string;
  url: string | null;
  imageUrl: string | null;
  isActive: boolean;
  productType: string | null;
  syncedAt: DateString;
  createdAt: DateString;
  updatedAt: DateString;
};

export type ApiGameExternalMapping = {
  id: string;
  gameId: string;
  provider: "gog" | string;
  externalId: string;
  externalSlug: string | null;
  confidence: ApiGogMappingConfidence;
  createdAt: DateString;
  updatedAt: DateString;
};

export type ApiGogStatus = {
  gogEnabled: boolean;
  gogCatalogEntries: number;
  gogMappings: number;
  gogMappedGames: number;
  lastGogSync: DateString | null;
  lastGogCatalogSearch: DateString | null;
  lastGogError: ApiIntegrationLog | null;
  requestLimitPerHour: number;
  countryCode: string;
  currency: string;
  gogOfferCount: number;
  gogPriceSnapshotCount: number;
  lastGogPriceRefresh: DateString | null;
  statusMessage: string | null;
  integrationLogs: ApiIntegrationLog[];
};

export type ApiGogCatalogSearchRequest = {
  query: string;
  limit?: number;
};

export type ApiGogCatalogSearchResponse = {
  query: string;
  results: ApiGogCatalogEntry[];
  upserted: {
    created: number;
    updated: number;
  };
};

export type ApiGogCatalogDiscoverRequest = {
  mode?: "imported-games" | "top-steam-catalog";
  queries?: string[];
  limit?: number;
};

export type ApiGogCatalogSuggestedMapping = {
  gameId: string;
  steamAppId: number;
  gameTitle: string;
  gogProductId: string;
  gogTitle: string;
  externalSlug: string | null;
  confidence: ApiGogMappingConfidence;
  reason: string;
};

export type ApiGogCatalogDiscoverResponse = {
  mode: "imported-games" | "top-steam-catalog" | "queries";
  searchedQueries: string[];
  foundProducts: number;
  createdCatalogEntries: number;
  updatedCatalogEntries: number;
  suggestedMappings: ApiGogCatalogSuggestedMapping[];
  uncertainMatches: ApiGogCatalogSuggestedMapping[];
};

export type ApiGogMappingSuggestRequest = {
  mode?: "imported-games";
  limit?: number;
};

export type ApiGogMappingSuggestResponse = {
  mode: "imported-games";
  exactMatches: ApiGogCatalogSuggestedMapping[];
  reviewRequired: ApiGogCatalogSuggestedMapping[];
  uncertain: ApiGogCatalogSuggestedMapping[];
  skipped: Array<{
    gameId: string;
    steamAppId: number;
    title: string;
    reason: string;
  }>;
};

export type ApiGogMappingRequest = {
  gameId: string;
  gogProductId: string;
  externalSlug?: string | null;
  confidence?: ApiGogMappingConfidence;
};

export type ApiGogResolveGameRequest = {
  gameId: string;
  limit?: number;
};

export type ApiGogResolveGameResponse = {
  gameId: string;
  existingMapping: ApiGameExternalMapping | null;
  suggestions: Array<ApiGogCatalogEntry & { confidence: ApiGogMappingConfidence; reason: string }>;
};

export type ApiGogPriceTestRequest = {
  gogProductId: string;
  externalSlug?: string | null;
  countryCode?: string;
  currency?: string;
};

export type ApiGogPricePreview = {
  gogProductId: string;
  title: string;
  slug: string;
  storeName: "GOG";
  storeType: "official";
  sourceName: "gog";
  sourceType: "store-api";
  price: number;
  regularPrice: number | null;
  currency: string;
  countryCode: string;
  discountPercent: number;
  drm: "DRM-free";
  externalUrl: string;
  available: boolean;
};

export type ApiMockPriceCleanupPreview = {
  mode: "preview";
  mockStoreOfferCount: number;
  mockPriceSnapshotCount: number;
  mockPriceSourceCount: number;
  affectedGameCount: number;
  affectedGames: Array<{
    gameId: string;
    steamAppId: number;
    title: string;
    mockOfferCount: number;
    mockPriceSnapshotCount: number;
  }>;
  examples: Array<{
    kind: "offer" | "price-snapshot" | "price-source";
    id: string;
    gameId?: string | null;
    steamAppId?: number | null;
    title?: string | null;
    storeName?: string | null;
    sourceName?: string | null;
  }>;
  whatWillBeDeleted: string[];
  whatWillBeKept: string[];
  requiresConfirmation: "DELETE_MOCK_PRICE_DATA_ONLY";
  destructive: boolean;
};

export type ApiMockPriceCleanupRunRequest = {
  confirm: "DELETE_MOCK_PRICE_DATA_ONLY";
};

export type ApiMockPriceCleanupRunResponse = Omit<ApiMockPriceCleanupPreview, "mode"> & {
  mode: "run";
  deletedStoreOffers: number;
  deletedPriceSnapshots: number;
  deletedPriceSources: number;
  completedAt: DateString;
};

export type ApiSteamStorePriceStatus = {
  steamStorePriceEnabled: boolean;
  countryCode: string;
  currency: string;
  maxPerRun: number;
  cacheTtlMinutes: number;
  steamStoreOfferCount: number;
  steamStorePriceSnapshotCount: number;
  catalogStoreOfferCount: number;
  lastSteamStorePriceRefresh: DateString | null;
  lastSteamStorePriceError: ApiIntegrationLog | null;
  statusMessage: string | null;
  integrationLogs: ApiIntegrationLog[];
};

export type ApiSteamStorePriceTestRequest = {
  steamAppId: number;
  countryCode?: string;
  currency?: string;
};

export type ApiSteamStorePricePreview = {
  steamAppId: number;
  title: string | null;
  storeName: "Steam";
  storeType: "official";
  sourceName: "steam-store";
  sourceType: "store-api-experimental";
  price: number;
  regularPrice: number | null;
  currency: string;
  countryCode: string;
  discountPercent: number;
  drm: "Steam";
  externalUrl: string;
  available: boolean;
  isFreeToPlay: boolean;
};

export type ApiSteamStorePriceTestResponse = {
  configured: boolean;
  result: ApiSteamStorePricePreview | null;
  error: string | null;
};

export type ApiSteamStorePriceRefreshRequest = {
  mode?: "imported" | "catalog-backfill";
  steamAppIds?: number[];
  gameIds?: string[];
  limit?: number;
  dryRun?: boolean;
};

export type ApiSteamStorePriceRefreshResult = {
  gameId: string | null;
  steamAppId: number;
  refreshed: boolean;
  skipped: boolean;
  preview: ApiSteamStorePricePreview | null;
  offerId: string | null;
  snapshotId: string | null;
  message: string | null;
};

export type ApiSteamStorePriceRefreshResponse = {
  provider: "gamevalue";
  sourceName: "steam-store";
  dryRun: boolean;
  requested: number;
  refreshed: number;
  skipped: number;
  failed: number;
  createdOffers?: number;
  updatedOffers?: number;
  createdSnapshots?: number;
  skippedFreshCache?: number;
  skippedNoPrice?: number;
  startedAt?: DateString;
  finishedAt?: DateString;
  durationMs?: number;
  errors: Array<{ steamAppId: number; gameId?: string; message: string }>;
  results: ApiSteamStorePriceRefreshResult[];
};

export type ApiAutomationSourceReport = {
  source: "steam-store" | "gog" | "player-counts";
  mode: string;
  dryRun: boolean;
  requested: number;
  refreshed: number;
  skipped: number;
  skippedFreshCache: number;
  skippedNoMapping: number;
  skippedNoPrice: number;
  failed: number;
  createdOffers: number;
  updatedOffers: number;
  createdSnapshots: number;
  errors: Array<{ input: string; message: string }>;
  startedAt: DateString;
  finishedAt: DateString;
  durationMs: number;
};

export type ApiPriceRefreshAutomationResponse = {
  source: "price-refresh";
  mode: "scheduled" | "manual" | "catalog-backfill";
  dryRun: boolean;
  enabled: boolean;
  requested: number;
  refreshed: number;
  skipped: number;
  skippedFreshCache: number;
  skippedNoMapping: number;
  skippedNoPrice: number;
  failed: number;
  createdOffers: number;
  updatedOffers: number;
  createdSnapshots: number;
  errors: Array<{ input: string; message: string }>;
  startedAt: DateString;
  finishedAt: DateString;
  durationMs: number;
  reports: ApiAutomationSourceReport[];
};

export type ApiGogPriceTestResponse = {
  configured: boolean;
  result: ApiGogPricePreview | null;
  error: string | null;
};

export type ApiGogPriceRefreshRequest = {
  mode?: "mapped-games";
  gameIds?: string[];
  limit?: number;
  dryRun?: boolean;
};

export type ApiGogPriceRefreshResult = {
  gameId: string;
  gogProductId: string;
  refreshed: boolean;
  skipped: boolean;
  preview: ApiGogPricePreview | null;
  offerId: string | null;
  snapshotId: string | null;
  message: string | null;
};

export type ApiGogPriceRefreshResponse = {
  provider: "gamevalue";
  sourceName: "gog";
  dryRun: boolean;
  requested: number;
  refreshed: number;
  skipped: number;
  failed: number;
  skippedFreshCache?: number;
  skippedNoMapping?: number;
  startedAt?: DateString;
  finishedAt?: DateString;
  durationMs?: number;
  errors: Array<{ gameId: string; gogProductId?: string; message: string }>;
  results: ApiGogPriceRefreshResult[];
};

export type ApiManualOfferRequest = {
  steamAppId: number;
  storeName: string;
  storeType?: StoreType;
  price: number;
  regularPrice?: number | null;
  currency?: string;
  externalUrl?: string | null;
  region?: string;
  drm?: string;
  platform?: string;
  isOfficialStore?: boolean;
  available?: boolean;
  sourceName?: string;
  title?: string;
};

export type ApiPriceImportJsonRequest = {
  sourceName: string;
  offers: ApiManualOfferRequest[];
};

export type ApiPriceImportCsvRequest = {
  sourceName: string;
  csv: string;
};

export type ApiPriceSnapshotRequest = {
  steamAppId: number;
  sourceName?: string;
};

export type ApiPriceIngestionResult = {
  input: string;
  gameId: string | null;
  steamAppId: number;
  title: string | null;
  createdStore: boolean;
  createdSource: boolean;
  offerId: string | null;
  snapshotId: string | null;
  skipped: boolean;
  message: string | null;
};

export type ApiPriceIngestionResponse = {
  provider: "gamevalue";
  mode: "internal";
  requested: number;
  stored: number;
  skipped: number;
  failed: number;
  errors: Array<{ input: string; message: string }>;
  results: ApiPriceIngestionResult[];
};

export type ApiPriceRefreshError = {
  input: string;
  steamAppId?: number;
  message: string;
  errorType?: GGDealsErrorType;
};

export type ApiPriceRefreshResult = {
  input: string;
  gameId: string;
  steamAppId: number;
  title: string;
  provider: PriceProviderName | string;
  offerCount: number;
  refreshed: boolean;
  skipped: boolean;
  bestPrice: number | null;
  storeName: string | null;
};

export type ApiPriceRefreshResponse = {
  mode: "imported" | "best" | "explicit";
  dryRun: boolean;
  provider: PriceProviderName | string;
  providerStatus: GGDealsProviderStatus | null;
  fallbackUsed: boolean;
  message: string | null;
  requested: number;
  refreshed: number;
  skipped: number;
  failed: number;
  errors: ApiPriceRefreshError[];
  results: ApiPriceRefreshResult[];
};

export type ApiPriceProviderDiagnosticsAttempt = {
  provider: "ggdeals";
  steamAppId: number;
  baseUrl: string;
  requestUrl: string;
  httpStatus: number | null;
  ok: boolean;
  contentType: string | null;
  responseKind: "json" | "html" | "text" | "empty" | "network";
  cloudflareDetected: boolean;
  apiErrorDetected: boolean;
  errorType: GGDealsErrorType | null;
  providerStatus: GGDealsProviderStatus;
  message: string;
  safePreview: string | null;
};

export type ApiPriceProviderDiagnosticsRequest = {
  provider?: "ggdeals";
  steamAppIds?: number[];
  dryRun?: boolean;
};

export type ApiPriceProviderDiagnosticsResponse = {
  provider: "ggdeals";
  configured: boolean;
  dryRun: boolean;
  hasApiKey: boolean;
  region: string;
  currency: string;
  status: GGDealsProviderStatus;
  lastCheckedAt: DateString;
  attempts: ApiPriceProviderDiagnosticsAttempt[];
  recommendation: string;
};

export type ApiGamePricesResponse = {
  gameId: string;
  history: ApiGamePriceSnapshot[];
  offers: ApiStoreOffer[];
  freshness: {
    latestPriceRefresh: DateString | null;
    freshness: PriceFreshness;
    nextRefreshAt: DateString | null;
  };
};

export type ApiPlayerCountRefreshError = {
  steamAppId: number;
  message: string;
};

export type ApiPlayerCountRefreshResponse = {
  mode: "watchlist" | "top" | "all-imported" | "explicit";
  source?: "steam";
  dryRun?: false;
  requested: number;
  refreshed: number;
  skippedFreshCache?: number;
  failed: number;
  errors: ApiPlayerCountRefreshError[];
  snapshots: ApiPlayerCountSnapshot[];
  startedAt?: DateString;
  finishedAt?: DateString;
  durationMs?: number;
};

export type ApiBulkImportResult = {
  input: string;
  created: boolean;
  source: ApiImportGameSource;
  steamAppId: number;
  gameId: string;
  title: string;
  refreshed: boolean;
};

export type ApiBulkImportError = {
  input: string;
  message: string;
};

export type ApiBulkImportResponse = {
  imported: number;
  skipped: number;
  refreshed: number;
  failed: number;
  errors: ApiBulkImportError[];
  results: ApiBulkImportResult[];
};

export type SearchResponse = {
  query: string;
  limit: number;
  offset: number;
  total: number;
  nextOffset: number | null;
  results: ApiGameSearchResult[];
};

export type BestDealsResponse = {
  results: ApiGameSummary[];
};

export type WatchlistResponse = {
  results: ApiWatchlistItem[];
};

export type WatchlistCreateResponse = {
  item: Omit<ApiWatchlistItem, "summary">;
};
