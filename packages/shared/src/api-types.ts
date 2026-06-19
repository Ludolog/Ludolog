export type DateString = string;

export type DataMode = "mock" | "api";

export type StatsDataMode = "real" | "mixed" | "mock";

export type DataSource = "mock" | "steam-api" | "price-api" | "prisma" | "ggdeals" | "manual";

export type PriceProviderName = "mock" | "ggdeals" | "itad" | "cheapshark";

export type PriceMode = "mock" | "api";

export type StoreType = "official" | "keyshop" | "marketplace" | "unknown";

export type Recommendation = "buy_now" | "wait" | "weak_deal";

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
  provider: PriceProviderName | string;
  storeName: string;
  storeType: StoreType;
  price: number;
  regularPrice: number | null;
  historicalLow: number | null;
  currency: string;
  discountPercent: number;
  url: string;
  externalUrl: string | null;
  isOfficial: boolean;
  isHistoricalLow: boolean;
  drm: string;
  sourceRawId: string | null;
  fetchedAt: DateString | null;
  updatedAt: DateString;
  source: DataSource;
};

export type ApiGamePriceSnapshot = {
  id: string;
  gameId: string;
  provider: PriceProviderName | string;
  storeType: StoreType;
  price: number;
  historicalLow: number;
  basePrice: number;
  discountPercent: number;
  storeName: string;
  currency: string;
  externalUrl: string | null;
  isHistoricalLow: boolean;
  sourceRawId: string | null;
  fetchedAt: DateString | null;
  capturedAt: DateString;
  source: DataSource;
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
  historicalLow: number;
  discountPercent: number;
  gameValueScore: number;
  recommendation: Recommendation;
  playerSource: DataSource;
  priceSource: DataSource;
  priceExternalUrl: string | null;
  tags: string[];
};

export type ApiStatsCategory = {
  id: string;
  title: string;
  description: string;
  games: ApiStatsGame[];
};

export type ApiStatsOverview = {
  topPlayers: ApiStatsGame[];
  trending: ApiStatsGame[];
  biggestGrowth: ApiStatsGame[];
  biggestDrop: ApiStatsGame[];
  bestValue: ApiStatsGame[];
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
    realPriceSnapshots: number;
    mockPriceSnapshots: number;
    realOffers: number;
    mockOffers: number;
    realPlayerSnapshots: number;
    mockPlayerSnapshots: number;
  };
  updatedAt: DateString;
  mode: StatsDataMode;
  ggdealsStatus: GGDealsProviderStatus;
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
  service: "steam" | "ggdeals" | "price" | "search" | "snapshot" | "alerts";
  level: "info" | "warning" | "error";
  message: string;
  createdAt: DateString;
};

export type ApiSteamCatalogStatus = {
  steamCatalogEntryCount: number;
  activeGameCount: number;
  lastSteamCatalogSync: DateString | null;
  nextSteamCatalogStartAfterAppId: number | null;
  lastSteamCatalogError: ApiIntegrationLog | null;
  hasSteamApiKey: boolean;
  dataMode: DataMode;
  canUseRealSteamApi: boolean;
  integrationLogs: ApiIntegrationLog[];
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
  playerSnapshotCount: number;
  watchlistCount: number;
  alertCount: number;
  priceProvider: PriceProviderName;
  priceMode: PriceMode;
  hasGGDealsApiKey: boolean;
  ggdealsStatus: GGDealsProviderStatus;
  lastGGDealsCheck: DateString | null;
  lastPriceRefresh: DateString | null;
  realPriceSnapshots: number;
  mockPriceSnapshots: number;
  realOffers: number;
  mockOffers: number;
  realPlayerSnapshots: number;
  mockPlayerSnapshots: number;
  integrationLogs: ApiIntegrationLog[];
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
};

export type ApiPlayerCountRefreshError = {
  steamAppId: number;
  message: string;
};

export type ApiPlayerCountRefreshResponse = {
  mode: "watchlist" | "top" | "all-imported" | "explicit";
  requested: number;
  refreshed: number;
  failed: number;
  errors: ApiPlayerCountRefreshError[];
  snapshots: ApiPlayerCountSnapshot[];
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
