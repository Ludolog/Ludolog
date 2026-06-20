import { DEMO_USER_ID } from "@/lib/config";
import {
  addWatchlistItem,
  appendPlayerSnapshot,
  appendPriceSnapshot,
  checkTriggeredAlerts,
  countPlayerSnapshotsBySource,
  countOffersBySource,
  countPriceSnapshotsBySource,
  createPriceAlert,
  findGogCatalogEntryByProductId,
  findGogMappingByGameId,
  findGogMappingsByGameIds,
  findSteamCatalogEntryBySteamAppId,
  getAdminStatus,
  getBestDeals,
  getGameById,
  getGameBySteamAppId,
  getGogRepositoryStatus,
  getGameProfile,
  getGameSummary,
  getLatestPlayersBySteamAppId,
  getLatestPlayerRefresh,
  getLatestPriceRefresh,
  getMostActiveGames,
  getOffersForGame,
  listPriceSources,
  listStores,
  getPlayerHistory,
  getPriceHistory,
  importGameFromCatalog,
  listImportedGames,
  listGames,
  listGogMappings,
  listIntegrationLogs,
  listSteamCatalogEntries,
  listPriceAlerts,
  listWatchlist,
  recordIntegrationLog,
  previewMockPriceCleanup,
  runMockPriceCleanup,
  removeWatchlistItem,
  searchGames,
  searchGogCatalogEntries,
  searchSteamCatalogEntries,
  upsertGogCatalogEntries,
  upsertGogMapping,
  upsertPriceSource,
  upsertSteamCatalogEntries,
  upsertStore,
  upsertStoreOffers,
  getSteamCatalogStatus
} from "@/lib/store";
import type {
  AlertRepository,
  AppRepositories,
  CatalogStoreOfferInput,
  CatalogStoreOfferRepository,
  DiagnosticsRepository,
  GameRepository,
  GogRepository,
  PriceRepository,
  PriceDataSource,
  SnapshotRepository,
  SteamCatalogRepository,
  SteamCatalogUpsertInput,
  WatchlistRepository
} from "@/lib/repositories/contracts";
import type { GameImportInput, GamePriceSnapshot, PlayerCountSnapshot, StoreOffer } from "@/lib/types";
import type { CatalogStoreOffer } from "@/lib/types";

const catalogStoreOffers: CatalogStoreOffer[] = [];

function catalogOfferFreshness(fetchedAt: Date, staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)): CatalogStoreOffer["freshness"] {
  return fetchedAt.getTime() < staleBefore.getTime() ? "stale" : "fresh";
}

class MockGameRepository implements GameRepository {
  async list() {
    return listGames();
  }

  async listImported(limit?: number) {
    return listImportedGames(limit);
  }

  async findById(id: string) {
    return getGameById(id);
  }

  async findBySteamAppId(steamAppId: number) {
    return getGameBySteamAppId(steamAppId);
  }

  async search(query: string) {
    return searchGames(query);
  }

  async importFromCatalog(input: GameImportInput) {
    return importGameFromCatalog(input);
  }

  async getSummary(id: string) {
    return getGameSummary(id);
  }

  async getProfile(id: string) {
    return getGameProfile(id);
  }

  async bestDeals(limit?: number) {
    return getBestDeals(limit);
  }

  async mostActive(limit?: number) {
    return getMostActiveGames(limit);
  }

  async listOffers(gameId: string) {
    return getOffersForGame(gameId);
  }

  async upsertOffers(gameId: string, offers: StoreOffer[]) {
    upsertStoreOffers(gameId, offers);
  }

  async countOffersBySource(source: PriceDataSource) {
    return countOffersBySource(source);
  }
}

class MockPriceRepository implements PriceRepository {
  async upsertStore(input: Parameters<typeof upsertStore>[0]) {
    return upsertStore(input);
  }

  async upsertPriceSource(input: Parameters<typeof upsertPriceSource>[0]) {
    return upsertPriceSource(input);
  }

  async listStores() {
    return listStores();
  }

  async listPriceSources() {
    return listPriceSources();
  }

  async status() {
    return {
      offerCount:
        countOffersBySource("mock") +
        countOffersBySource("manual") +
        countOffersBySource("gog") +
        countOffersBySource("steam-store") +
        countOffersBySource("ggdeals") +
        countOffersBySource("price-api"),
      priceSnapshotCount:
        countPriceSnapshotsBySource("mock") +
        countPriceSnapshotsBySource("manual") +
        countPriceSnapshotsBySource("gog") +
        countPriceSnapshotsBySource("steam-store") +
        countPriceSnapshotsBySource("ggdeals") +
        countPriceSnapshotsBySource("price-api"),
      storeCount: listStores().length,
      priceSourceCount: listPriceSources().length,
      lastPriceSnapshot: getLatestPriceRefresh(),
      realInternalPriceSnapshots:
        countPriceSnapshotsBySource("manual") +
        countPriceSnapshotsBySource("gog") +
        countPriceSnapshotsBySource("steam-store"),
      mockPriceSnapshots: countPriceSnapshotsBySource("mock"),
      realOffers:
        countOffersBySource("manual") + countOffersBySource("gog") + countOffersBySource("steam-store"),
      mockOffers: countOffersBySource("mock"),
      steamStoreOfferCount: countOffersBySource("steam-store"),
      steamStorePriceSnapshotCount: countPriceSnapshotsBySource("steam-store"),
      catalogStoreOfferCount: catalogStoreOffers.length
    };
  }

  async previewMockCleanup() {
    return previewMockPriceCleanup();
  }

  async runMockCleanup() {
    return runMockPriceCleanup();
  }
}

class MockCatalogStoreOfferRepository implements CatalogStoreOfferRepository {
  async upsert(input: CatalogStoreOfferInput) {
    const now = new Date();
    const existingIndex = catalogStoreOffers.findIndex((offer) => offer.id === input.id);
    const existing = existingIndex >= 0 ? catalogStoreOffers[existingIndex] : null;
    const offer: CatalogStoreOffer = {
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sourceConfidence: input.provider === "steam-store" ? "experimental-store-api" : "internal-real",
      sourceName: input.provider,
      freshness: catalogOfferFreshness(input.fetchedAt)
    };
    if (existingIndex >= 0) {
      catalogStoreOffers[existingIndex] = offer;
    } else {
      catalogStoreOffers.push(offer);
    }
    return { offer, created: existing === null };
  }

  async findBySteamAppIds(steamAppIds: number[]) {
    const ids = new Set(steamAppIds);
    return catalogStoreOffers
      .filter((offer) => offer.steamAppId !== null && ids.has(offer.steamAppId))
      .map((offer) => ({ ...offer, freshness: catalogOfferFreshness(offer.fetchedAt) }));
  }

  async listSteamBackfillCandidates(limit: number, staleBefore: Date) {
    const games = new Set(listGames().map((game) => game.steamAppId));
    const fresh = new Set(
      catalogStoreOffers
        .filter((offer) => offer.provider === "steam-store" && offer.fetchedAt >= staleBefore && offer.steamAppId !== null)
        .map((offer) => offer.steamAppId as number)
    );
    return listSteamCatalogEntries(Math.max(limit * 3, limit))
      .filter((entry) => !games.has(entry.steamAppId) && !fresh.has(entry.steamAppId))
      .slice(0, limit);
  }

  async status(staleBefore: Date) {
    const steamCatalogOffers = catalogStoreOffers.filter((offer) => offer.provider === "steam-store");
    return {
      catalogStoreOfferCount: catalogStoreOffers.length,
      staleCatalogStoreOfferCount: catalogStoreOffers.filter((offer) => offer.fetchedAt < staleBefore).length,
      lastCatalogStoreOfferRefresh:
        steamCatalogOffers.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0]?.fetchedAt ?? null
    };
  }
}

class MockSteamCatalogRepository implements SteamCatalogRepository {
  async search(query: string, limit?: number) {
    return searchSteamCatalogEntries(query, limit);
  }

  async findBySteamAppId(steamAppId: number) {
    return findSteamCatalogEntryBySteamAppId(steamAppId);
  }

  async upsertMany(entries: SteamCatalogUpsertInput[]) {
    return upsertSteamCatalogEntries(entries);
  }

  async status() {
    return getSteamCatalogStatus();
  }
}

class MockGogRepository implements GogRepository {
  async searchCatalog(query: string, limit?: number) {
    return searchGogCatalogEntries(query, limit);
  }

  async findCatalogByProductId(gogProductId: string) {
    return findGogCatalogEntryByProductId(gogProductId);
  }

  async upsertCatalogEntries(entries: Parameters<typeof upsertGogCatalogEntries>[0]) {
    return upsertGogCatalogEntries(entries);
  }

  async listMappings(limit?: number) {
    return listGogMappings(limit);
  }

  async findMappingByGameId(gameId: string) {
    return findGogMappingByGameId(gameId);
  }

  async findMappingsByGameIds(gameIds: string[]) {
    return findGogMappingsByGameIds(gameIds);
  }

  async upsertMapping(input: Parameters<typeof upsertGogMapping>[0]) {
    return upsertGogMapping(input);
  }

  async status() {
    return getGogRepositoryStatus();
  }
}

class MockWatchlistRepository implements WatchlistRepository {
  async list(userId = DEMO_USER_ID) {
    return listWatchlist(userId);
  }

  async add(gameId: string, targetPrice?: number | null, userId = DEMO_USER_ID) {
    return addWatchlistItem(gameId, targetPrice, userId);
  }

  async remove(id: string, userId = DEMO_USER_ID) {
    return removeWatchlistItem(id, userId);
  }
}

class MockAlertRepository implements AlertRepository {
  async create(gameId: string, thresholdPrice: number, userId = DEMO_USER_ID) {
    return createPriceAlert(gameId, thresholdPrice, userId);
  }

  async list(userId = DEMO_USER_ID) {
    return listPriceAlerts(userId);
  }

  async checkTriggered() {
    return checkTriggeredAlerts();
  }
}

class MockSnapshotRepository implements SnapshotRepository {
  async listPrices(gameId: string) {
    return getPriceHistory(gameId);
  }

  async listPlayers(gameId: string) {
    return getPlayerHistory(gameId);
  }

  async latestPlayersBySteamAppId(steamAppId: number) {
    return getLatestPlayersBySteamAppId(steamAppId);
  }

  async latestPlayerRefresh() {
    return getLatestPlayerRefresh();
  }

  async countPlayerSnapshotsBySource(source: "mock" | "steam-api") {
    return countPlayerSnapshotsBySource(source);
  }

  async latestPriceRefresh() {
    return getLatestPriceRefresh();
  }

  async countPriceSnapshotsBySource(source: PriceDataSource) {
    return countPriceSnapshotsBySource(source);
  }

  async appendPrice(snapshot: GamePriceSnapshot) {
    appendPriceSnapshot(snapshot);
  }

  async appendPlayers(snapshot: PlayerCountSnapshot) {
    appendPlayerSnapshot(snapshot);
  }
}

class MockDiagnosticsRepository implements DiagnosticsRepository {
  async recordIntegrationLog(log: Parameters<typeof recordIntegrationLog>[0]) {
    return recordIntegrationLog(log);
  }

  async listIntegrationLogs(limit?: number) {
    return listIntegrationLogs(limit);
  }

  async getAdminStatus() {
    return getAdminStatus();
  }
}

export function createMockRepositories(): AppRepositories {
  return {
    provider: "mock",
    games: new MockGameRepository(),
    steamCatalog: new MockSteamCatalogRepository(),
    gog: new MockGogRepository(),
    prices: new MockPriceRepository(),
    catalogOffers: new MockCatalogStoreOfferRepository(),
    watchlist: new MockWatchlistRepository(),
    alerts: new MockAlertRepository(),
    snapshots: new MockSnapshotRepository(),
    diagnostics: new MockDiagnosticsRepository()
  };
}
