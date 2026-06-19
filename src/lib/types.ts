export type DataMode = "mock" | "api";

export type DataSource = "mock" | "steam-api" | "price-api" | "prisma";

export type Recommendation = "buy_now" | "wait" | "weak_deal";

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
  createdAt: Date;
  updatedAt: Date;
};

export type StoreOffer = {
  id: string;
  gameId: string;
  storeName: string;
  price: number;
  currency: string;
  discountPercent: number;
  url: string;
  isOfficial: boolean;
  drm: string;
  updatedAt: Date;
  source: DataSource;
};

export type GamePriceSnapshot = {
  id: string;
  gameId: string;
  price: number;
  historicalLow: number;
  basePrice: number;
  discountPercent: number;
  storeName: string;
  currency: string;
  capturedAt: Date;
  source: DataSource;
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
  service: "steam" | "price" | "search" | "snapshot" | "alerts";
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
  offerCount: number;
  priceSnapshotCount: number;
  playerSnapshotCount: number;
  watchlistCount: number;
  alertCount: number;
  integrationLogs: IntegrationLog[];
};
