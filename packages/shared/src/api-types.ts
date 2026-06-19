export type DateString = string;

export type DataMode = "mock" | "api";

export type StatsDataMode = "real" | "mixed" | "mock";

export type DataSource = "mock" | "steam-api" | "price-api" | "prisma";

export type Recommendation = "buy_now" | "wait" | "weak_deal";

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
  storeName: string;
  price: number;
  currency: string;
  discountPercent: number;
  url: string;
  isOfficial: boolean;
  drm: string;
  updatedAt: DateString;
  source: DataSource;
};

export type ApiGamePriceSnapshot = {
  id: string;
  gameId: string;
  price: number;
  historicalLow: number;
  basePrice: number;
  discountPercent: number;
  storeName: string;
  currency: string;
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
};

export type ApiImportGameResponse = {
  imported: boolean;
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
  };
  sourceCounts: {
    importedGames: number;
    steamCatalogEntries: number;
    realPlayerSnapshots: number;
    mockPlayerSnapshots: number;
  };
  updatedAt: DateString;
  mode: StatsDataMode;
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
  service: "steam" | "price" | "search" | "snapshot" | "alerts";
  level: "info" | "warning" | "error";
  message: string;
  createdAt: DateString;
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
  integrationLogs: ApiIntegrationLog[];
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
