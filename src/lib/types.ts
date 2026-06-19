export type DataMode = "mock" | "api";

export type StatsDataMode = "real" | "mixed" | "mock";

export type DataSource = "mock" | "steam-api" | "price-api" | "prisma" | "ggdeals" | "manual";

export type PriceProviderName = "gamevalue" | "mock" | "ggdeals" | "itad" | "cheapshark";

export type PriceMode = "internal" | "mock" | "api";

export type StoreType = "official" | "keyshop" | "marketplace" | "unknown";

export type Recommendation = "buy_now" | "wait" | "weak_deal";

export type PriceSourceType = "manual" | "csv" | "json" | "partner" | "mock" | "store-api";

export type PriceSourceConfidence = "internal-real" | "internal-mock" | "external-legacy" | "no-price-data";

export type PriceSource = {
  id: string;
  name: string;
  type: PriceSourceType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  service: "steam" | "ggdeals" | "price" | "search" | "snapshot" | "alerts";
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
  realPlayerSnapshots: number;
  mockPlayerSnapshots: number;
  integrationLogs: IntegrationLog[];
};
