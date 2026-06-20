export type DataMode = "mock" | "api";

export type StatsDataMode = "real" | "mixed" | "mock";

export type DataSource = "mock" | "steam-api" | "steam-store" | "price-api" | "prisma" | "ggdeals" | "manual" | "gog";

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

export type PriceSource = {
  id: string;
  name: string;
  type: PriceSourceType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GogMappingConfidence = "exact" | "title-match" | "manual" | "unknown";

export type GogCatalogEntry = {
  id: string;
  gogProductId: string;
  title: string;
  slug: string;
  url: string | null;
  imageUrl: string | null;
  isActive: boolean;
  productType: string | null;
  rawData: unknown | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type GameExternalMapping = {
  id: string;
  gameId: string;
  provider: "gog" | string;
  externalId: string;
  externalSlug: string | null;
  confidence: GogMappingConfidence;
  createdAt: Date;
  updatedAt: Date;
};

export type GogRepositoryStatus = {
  gogCatalogEntries: number;
  gogMappings: number;
  lastGogSync: Date | null;
  lastGogCatalogSearch: Date | null;
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  storeType: StoreType;
  websiteUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export type Game = {
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
  releaseDate: string;
  reviewScore: number;
  source: DataSource;
  createdAt: Date;
  updatedAt: Date;
};

export type SteamCatalogEntry = {
  id: string;
  steamAppId: number;
  title: string;
  appType: string;
  lastModified: number | null;
  priceChangeNumber: number | null;
  isGame: boolean;
  isActive: boolean;
  source: DataSource;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type StoreOffer = {
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
  rawProviderData: unknown | null;
  fetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  source: DataSource;
  sourceConfidence: PriceSourceConfidence;
  sourceName?: string | null;
  sourceType?: PriceSourceType | null;
};

export type CatalogStoreOffer = {
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
  rawProviderData: unknown | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  sourceConfidence: PriceSourceConfidence;
  sourceName: string | null;
  freshness: "fresh" | "stale" | "no-data";
};

export type CatalogPriceCheckStatusValue = "available" | "no-price" | "unsupported" | "error";

export type CatalogPriceCheckStatus = {
  id: string;
  sourceName: string;
  steamAppId: number | null;
  gogProductId: string | null;
  status: CatalogPriceCheckStatusValue;
  lastCheckedAt: Date;
  nextCheckAt: Date;
  lastError: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GamePriceSnapshot = {
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
  rawProviderData: unknown | null;
  fetchedAt: Date | null;
  capturedAt: Date;
  createdAt: Date;
  source: DataSource;
  sourceConfidence: PriceSourceConfidence;
  sourceName?: string | null;
  sourceType?: PriceSourceType | null;
};

export type PlayerCountSnapshot = {
  id: string;
  gameId: string;
  steamAppId: number;
  playersOnline: number;
  capturedAt: Date;
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

export type DealScoreSnapshot = {
  id: string;
  gameId: string;
  score: number;
  recommendation: Recommendation;
  factors: ScoreFactors;
  reason: string;
  capturedAt: Date;
};

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

export type WatchlistItem = {
  id: string;
  userId: string;
  gameId: string;
  targetPrice: number | null;
  alertEnabled: boolean;
  createdAt: Date;
};

export type PriceAlert = {
  id: string;
  userId: string;
  gameId: string;
  thresholdPrice: number;
  isActive: boolean;
  triggeredAt: Date | null;
  createdAt: Date;
};

export type IntegrationLog = {
  id: string;
  service: "steam" | "steam-store" | "ggdeals" | "gog" | "price" | "price-cleanup" | "search" | "snapshot" | "alerts";
  level: "info" | "warning" | "error";
  message: string;
  createdAt: Date;
};

export type GameSummary = {
  game: Game;
  latestPrice: GamePriceSnapshot | null;
  latestPlayers: PlayerCountSnapshot | null;
  bestOffer: StoreOffer | null;
  score: GameValueResult;
};

export type GameImportInput = Omit<Game, "createdAt" | "updatedAt"> & {
  basePrice: number;
  currentPrice: number;
  historicalLow: number;
  currentPlayers: number;
  trendFactor: number;
};

export type SteamCatalogStatus = {
  entryCount: number;
  activeGameCount: number;
  lastSyncedAt: Date | null;
  nextStartAfterAppId: number | null;
};

export type SteamCatalogRuntimeStatus = {
  steamCatalogEntryCount: number;
  activeGameCount: number;
  catalogCompleteness: "partial" | "full" | "unknown";
  fetchedTotal: number;
  lastSteamCatalogSync: Date | null;
  nextSteamCatalogStartAfterAppId: number | null;
  lastSteamCatalogError: IntegrationLog | null;
  hasSteamApiKey: boolean;
  dataMode: DataMode;
  canUseRealSteamApi: boolean;
  integrationLogs: IntegrationLog[];
};

export type GameProfile = GameSummary & {
  priceHistory: GamePriceSnapshot[];
  playerHistory: PlayerCountSnapshot[];
  offers: StoreOffer[];
  historicalLow: number | null;
  priceDeltaPercent: number | null;
};

export type AdminStatus = {
  mode: DataMode;
  gameCount: number;
  steamCatalogEntryCount: number;
  importedGameCount: number;
  lastSteamCatalogSync: Date | null;
  lastPlayerCountRefresh: Date | null;
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
  lastGGDealsCheck: Date | null;
  lastPriceRefresh: Date | null;
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
  lastGogSync: Date | null;
  lastGogCatalogSearch: Date | null;
  lastGogError: IntegrationLog | null;
  lastGogPriceRefresh: Date | null;
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
  lastSteamStorePriceRefresh: Date | null;
  lastSteamStorePriceError: IntegrationLog | null;
  realPlayerSnapshots: number;
  mockPlayerSnapshots: number;
  integrationLogs: IntegrationLog[];
};
