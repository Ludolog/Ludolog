import type {
  AdminStatus,
  GameExternalMapping,
  Game,
  GameImportInput,
  GamePriceSnapshot,
  GameProfile,
  GameSummary,
  GogCatalogEntry,
  GogMappingConfidence,
  GogRepositoryStatus,
  IntegrationLog,
  PlayerCountSnapshot,
  PriceAlert,
  PriceSource,
  PriceSourceType,
  SteamCatalogEntry,
  SteamCatalogStatus,
  Store,
  StoreOffer,
  StoreType,
  WatchlistItem
} from "@/lib/types";

export type RepositoryProvider = "mock" | "prisma";
export type PriceDataSource = "mock" | "ggdeals" | "price-api" | "manual" | "gog" | "steam-store";

export type WatchlistWithSummary = WatchlistItem & {
  summary: GameSummary | null;
};

export interface GameRepository {
  list(): Promise<Game[]>;
  listImported(limit?: number): Promise<Game[]>;
  findById(id: string): Promise<Game | null>;
  findBySteamAppId(steamAppId: number): Promise<Game | null>;
  search(query: string): Promise<GameSummary[]>;
  importFromCatalog(input: GameImportInput): Promise<GameSummary>;
  getSummary(id: string): Promise<GameSummary | null>;
  getProfile(id: string): Promise<GameProfile | null>;
  bestDeals(limit?: number): Promise<GameSummary[]>;
  mostActive(limit?: number): Promise<GameSummary[]>;
  listOffers(gameId: string): Promise<StoreOffer[]>;
  upsertOffers(gameId: string, offers: StoreOffer[]): Promise<void>;
  countOffersBySource(source: PriceDataSource): Promise<number>;
}

export type PriceStoreInput = {
  name: string;
  slug?: string;
  storeType: StoreType;
  websiteUrl?: string | null;
};

export type PriceSourceInput = {
  name: string;
  type: PriceSourceType;
};

export type PricesStatus = {
  offerCount: number;
  priceSnapshotCount: number;
  storeCount: number;
  priceSourceCount: number;
  lastPriceSnapshot: Date | null;
  realInternalPriceSnapshots: number;
  mockPriceSnapshots: number;
  realOffers: number;
  mockOffers: number;
  steamStoreOfferCount: number;
  steamStorePriceSnapshotCount: number;
};

export type MockPriceCleanupGame = {
  gameId: string;
  steamAppId: number;
  title: string;
  mockOfferCount: number;
  mockPriceSnapshotCount: number;
};

export type MockPriceCleanupExample = {
  kind: "offer" | "price-snapshot" | "price-source";
  id: string;
  gameId?: string | null;
  steamAppId?: number | null;
  title?: string | null;
  storeName?: string | null;
  sourceName?: string | null;
};

export type MockPriceCleanupPreview = {
  mockStoreOfferCount: number;
  mockPriceSnapshotCount: number;
  mockPriceSourceCount: number;
  affectedGameCount: number;
  affectedGames: MockPriceCleanupGame[];
  examples: MockPriceCleanupExample[];
};

export type MockPriceCleanupRun = MockPriceCleanupPreview & {
  deletedStoreOffers: number;
  deletedPriceSnapshots: number;
  deletedPriceSources: number;
};

export interface PriceRepository {
  upsertStore(input: PriceStoreInput): Promise<{ store: Store; created: boolean }>;
  upsertPriceSource(input: PriceSourceInput): Promise<{ source: PriceSource; created: boolean }>;
  listStores(): Promise<Store[]>;
  listPriceSources(): Promise<PriceSource[]>;
  status(): Promise<PricesStatus>;
  previewMockCleanup(): Promise<MockPriceCleanupPreview>;
  runMockCleanup(): Promise<MockPriceCleanupRun>;
}

export type SteamCatalogUpsertInput = Omit<SteamCatalogEntry, "createdAt" | "updatedAt">;

export type SteamCatalogUpsertResult = {
  created: number;
  updated: number;
};

export interface SteamCatalogRepository {
  search(query: string, limit?: number): Promise<SteamCatalogEntry[]>;
  findBySteamAppId(steamAppId: number): Promise<SteamCatalogEntry | null>;
  upsertMany(entries: SteamCatalogUpsertInput[]): Promise<SteamCatalogUpsertResult>;
  status(): Promise<SteamCatalogStatus>;
}

export type GogCatalogUpsertInput = Omit<GogCatalogEntry, "createdAt" | "updatedAt">;

export type GogCatalogUpsertResult = {
  created: number;
  updated: number;
};

export type GogMappingInput = {
  gameId: string;
  externalId: string;
  externalSlug?: string | null;
  confidence: GogMappingConfidence;
};

export interface GogRepository {
  searchCatalog(query: string, limit?: number): Promise<GogCatalogEntry[]>;
  upsertCatalogEntries(entries: GogCatalogUpsertInput[]): Promise<GogCatalogUpsertResult>;
  listMappings(limit?: number): Promise<GameExternalMapping[]>;
  findMappingByGameId(gameId: string): Promise<GameExternalMapping | null>;
  findMappingsByGameIds(gameIds: string[]): Promise<GameExternalMapping[]>;
  upsertMapping(input: GogMappingInput): Promise<GameExternalMapping>;
  status(): Promise<GogRepositoryStatus>;
}

export interface WatchlistRepository {
  list(userId?: string): Promise<WatchlistWithSummary[]>;
  add(gameId: string, targetPrice?: number | null, userId?: string): Promise<WatchlistItem>;
  remove(id: string, userId?: string): Promise<boolean>;
}

export interface AlertRepository {
  create(gameId: string, thresholdPrice: number, userId?: string): Promise<PriceAlert>;
  list(userId?: string): Promise<PriceAlert[]>;
  checkTriggered(): Promise<PriceAlert[]>;
}

export interface SnapshotRepository {
  listPrices(gameId: string): Promise<GamePriceSnapshot[]>;
  listPlayers(gameId: string): Promise<PlayerCountSnapshot[]>;
  latestPlayersBySteamAppId(steamAppId: number): Promise<PlayerCountSnapshot | null>;
  latestPlayerRefresh(): Promise<Date | null>;
  countPlayerSnapshotsBySource(source: "mock" | "steam-api"): Promise<number>;
  latestPriceRefresh(): Promise<Date | null>;
  countPriceSnapshotsBySource(source: PriceDataSource): Promise<number>;
  appendPrice(snapshot: GamePriceSnapshot): Promise<void>;
  appendPlayers(snapshot: PlayerCountSnapshot): Promise<void>;
}

export interface DiagnosticsRepository {
  recordIntegrationLog(log: Omit<IntegrationLog, "id" | "createdAt">): Promise<IntegrationLog>;
  listIntegrationLogs(limit?: number): Promise<IntegrationLog[]>;
  getAdminStatus(): Promise<AdminStatus>;
}

export interface AppRepositories {
  provider: RepositoryProvider;
  games: GameRepository;
  steamCatalog: SteamCatalogRepository;
  gog: GogRepository;
  prices: PriceRepository;
  watchlist: WatchlistRepository;
  alerts: AlertRepository;
  snapshots: SnapshotRepository;
  diagnostics: DiagnosticsRepository;
}
