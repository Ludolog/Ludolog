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
  listGogCatalogEntries,
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
  CatalogBackfillCandidate,
  CatalogPriceCheckStatusInput,
  CatalogPriceCheckStatusRepository,
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
  TopTrackedGameRepository,
  TopTrackedGameUpsertInput,
  WatchlistRepository
} from "@/lib/repositories/contracts";
import type { GameImportInput, GamePriceSnapshot, PlayerCountSnapshot, StoreOffer, TopTrackedGame } from "@/lib/types";
import type { CatalogPriceCheckStatus, CatalogStoreOffer } from "@/lib/types";

const catalogStoreOffers: CatalogStoreOffer[] = [];
const catalogPriceCheckStatuses: CatalogPriceCheckStatus[] = [];
const topTrackedGames: TopTrackedGame[] = [];

function catalogOfferFreshness(fetchedAt: Date, staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)): CatalogStoreOffer["freshness"] {
  return fetchedAt.getTime() < staleBefore.getTime() ? "stale" : "fresh";
}

function catalogPriceCheckStatusId(sourceName: string, steamAppId: number | null, gogProductId: string | null): string {
  if (steamAppId !== null) {
    return `catalog-price-check-${sourceName}-steam-${steamAppId}`;
  }
  return `catalog-price-check-${sourceName}-gog-${gogProductId ?? "unknown"}`;
}

function isWeakSteamStoreCandidateTitle(title: string): boolean {
  const normalized = title.toLowerCase();
  return [
    "demo",
    "dedicated server",
    "server",
    "soundtrack",
    " dlc",
    "sdk",
    " tool",
    "beta",
    "test",
    "trailer",
    "episode",
    "expansion pack",
    " pack",
    "bundle"
  ].some((term) => normalized.includes(term));
}

function steamBackfillCandidate(input: {
  steamAppId: number;
  title: string;
  appType: string;
  gameId: string | null;
  isImported: boolean;
  status: CatalogPriceCheckStatus | null;
  hasFreshOffer: boolean;
}): CatalogBackfillCandidate {
  const reasons = input.isImported ? ["imported-game"] : ["steam-catalog"];
  if (input.status?.status === "error") {
    reasons.push("retry-after-error");
  }
  if (!input.hasFreshOffer) {
    reasons.push("missing-or-stale-catalog-offer");
  }
  return {
    steamAppId: input.steamAppId,
    title: input.title,
    appType: input.appType,
    isImported: input.isImported,
    gameId: input.gameId,
    priority: (input.isImported ? 100 : 10) + (input.status?.status === "error" ? 5 : 0),
    reasons,
    lastCheckedAt: input.status?.lastCheckedAt ?? null,
    nextCheckAt: input.status?.nextCheckAt ?? null,
    lastStatus: input.status?.status ?? null
  };
}

function compareSteamBackfillCandidates(a: CatalogBackfillCandidate, b: CatalogBackfillCandidate): number {
  if (b.priority !== a.priority) {
    return b.priority - a.priority;
  }
  return a.steamAppId - b.steamAppId;
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

  async listSteamBackfillCandidates(limit: number, staleBefore: Date): Promise<CatalogBackfillCandidate[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const importedBySteamAppId = new Map(listImportedGames(100).map((game) => [game.steamAppId, game]));
    const fresh = new Set(
      catalogStoreOffers
        .filter((offer) => offer.provider === "steam-store" && offer.fetchedAt >= staleBefore && offer.steamAppId !== null)
        .map((offer) => offer.steamAppId as number)
    );
    const blocked = new Set(
      catalogPriceCheckStatuses
        .filter((status) => status.sourceName === "steam-store" && status.steamAppId !== null && status.nextCheckAt > new Date())
        .map((status) => status.steamAppId as number)
    );
    const statuses = new Map(
      catalogPriceCheckStatuses
        .filter((status) => status.sourceName === "steam-store" && status.steamAppId !== null)
        .map((status) => [status.steamAppId as number, status])
    );
    const candidates = new Map<number, CatalogBackfillCandidate>();

    for (const game of importedBySteamAppId.values()) {
      if (fresh.has(game.steamAppId) || blocked.has(game.steamAppId) || isWeakSteamStoreCandidateTitle(game.title)) {
        continue;
      }
      const status = statuses.get(game.steamAppId) ?? null;
      candidates.set(
        game.steamAppId,
        steamBackfillCandidate({
          steamAppId: game.steamAppId,
          title: game.title,
          appType: "game",
          gameId: game.id,
          isImported: true,
          status,
          hasFreshOffer: false
        })
      );
    }

    for (const entry of listSteamCatalogEntries(Math.max(safeLimit * 5, safeLimit))) {
      if (candidates.size >= safeLimit * 4) {
        break;
      }
      if (fresh.has(entry.steamAppId) || blocked.has(entry.steamAppId) || isWeakSteamStoreCandidateTitle(entry.title)) {
        continue;
      }
      const importedGame = importedBySteamAppId.get(entry.steamAppId) ?? null;
      const status = statuses.get(entry.steamAppId) ?? null;
      candidates.set(
        entry.steamAppId,
        steamBackfillCandidate({
          steamAppId: entry.steamAppId,
          title: entry.title,
          appType: entry.appType,
          gameId: importedGame?.id ?? null,
          isImported: importedGame !== null,
          status,
          hasFreshOffer: false
        })
      );
    }

    return [...candidates.values()].sort(compareSteamBackfillCandidates).slice(0, safeLimit);
  }

  async status(staleBefore: Date, provider?: string) {
    const steamCatalogOffers = catalogStoreOffers.filter((offer) => offer.provider === "steam-store");
    const providerOffers = provider ? catalogStoreOffers.filter((offer) => offer.provider === provider) : [];
    return {
      catalogStoreOfferCount: catalogStoreOffers.length,
      staleCatalogStoreOfferCount: catalogStoreOffers.filter((offer) => offer.fetchedAt < staleBefore).length,
      lastCatalogStoreOfferRefresh:
        steamCatalogOffers.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0]?.fetchedAt ?? null,
      providerCatalogStoreOfferCount: provider ? providerOffers.length : undefined,
      providerStaleCatalogStoreOfferCount: provider
        ? providerOffers.filter((offer) => offer.fetchedAt < staleBefore).length
        : undefined,
      providerLastCatalogStoreOfferRefresh: provider
        ? providerOffers.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0]?.fetchedAt ?? null
        : undefined
    };
  }
}

class MockCatalogPriceCheckStatusRepository implements CatalogPriceCheckStatusRepository {
  async upsert(input: CatalogPriceCheckStatusInput): Promise<CatalogPriceCheckStatus> {
    const id = catalogPriceCheckStatusId(input.sourceName, input.steamAppId ?? null, input.gogProductId ?? null);
    const now = new Date();
    const existingIndex = catalogPriceCheckStatuses.findIndex((status) => status.id === id);
    const existing = existingIndex >= 0 ? catalogPriceCheckStatuses[existingIndex] : null;
    const status: CatalogPriceCheckStatus = {
      id,
      sourceName: input.sourceName,
      steamAppId: input.steamAppId ?? null,
      gogProductId: input.gogProductId ?? null,
      status: input.status,
      lastCheckedAt: input.lastCheckedAt,
      nextCheckAt: input.nextCheckAt,
      lastError: input.lastError ?? null,
      attempts: (existing?.attempts ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    if (existingIndex >= 0) {
      catalogPriceCheckStatuses[existingIndex] = status;
    } else {
      catalogPriceCheckStatuses.push(status);
    }
    return status;
  }

  async findSteamStatuses(sourceName: string, steamAppIds: number[]): Promise<CatalogPriceCheckStatus[]> {
    const ids = new Set(steamAppIds);
    return catalogPriceCheckStatuses.filter(
      (status) => status.sourceName === sourceName && status.steamAppId !== null && ids.has(status.steamAppId)
    );
  }

  async findGogStatuses(sourceName: string, gogProductIds: string[]): Promise<CatalogPriceCheckStatus[]> {
    const ids = new Set(gogProductIds);
    return catalogPriceCheckStatuses.filter(
      (status) => status.sourceName === sourceName && status.gogProductId !== null && ids.has(status.gogProductId)
    );
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

class MockTopTrackedGameRepository implements TopTrackedGameRepository {
  async listActive(limit = 100) {
    return topTrackedGames
      .filter((entry) => entry.isActive)
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
      .slice(0, Math.max(1, Math.min(100, Math.floor(limit))));
  }

  async upsertMany(entries: TopTrackedGameUpsertInput[]) {
    let created = 0;
    let updated = 0;
    const now = new Date();
    for (const entry of entries) {
      const index = topTrackedGames.findIndex((item) => item.steamAppId === entry.steamAppId);
      const existing = index >= 0 ? topTrackedGames[index] : null;
      const next: TopTrackedGame = {
        ...entry,
        gameId: entry.gameId ?? existing?.gameId ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (index >= 0) {
        topTrackedGames[index] = next;
        updated += 1;
      } else {
        topTrackedGames.push(next);
        created += 1;
      }
    }
    return { created, updated };
  }

  async linkGame(steamAppId: number, gameId: string) {
    const entry = topTrackedGames.find((item) => item.steamAppId === steamAppId);
    if (entry) {
      entry.gameId = gameId;
      entry.updatedAt = new Date();
    }
  }

  async status() {
    const latest = [...topTrackedGames].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
    return {
      topTrackedCount: topTrackedGames.length,
      activeTopTrackedCount: topTrackedGames.filter((entry) => entry.isActive).length,
      importedCount: topTrackedGames.filter((entry) => entry.isActive && entry.gameId !== null).length,
      lastUpdatedAt: latest?.updatedAt ?? null
    };
  }
}

class MockGogRepository implements GogRepository {
  async searchCatalog(query: string, limit?: number) {
    return searchGogCatalogEntries(query, limit);
  }

  async listCatalogEntries(limit = 50) {
    return listGogCatalogEntries(limit);
  }

  async findCatalogByProductIds(gogProductIds: string[]) {
    const ids = new Set(gogProductIds);
    return gogProductIds
      .map((id) => findGogCatalogEntryByProductId(id))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null && ids.has(entry.gogProductId));
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
    topTrackedGames: new MockTopTrackedGameRepository(),
    gog: new MockGogRepository(),
    prices: new MockPriceRepository(),
    catalogOffers: new MockCatalogStoreOfferRepository(),
    catalogPriceChecks: new MockCatalogPriceCheckStatusRepository(),
    watchlist: new MockWatchlistRepository(),
    alerts: new MockAlertRepository(),
    snapshots: new MockSnapshotRepository(),
    diagnostics: new MockDiagnosticsRepository()
  };
}
