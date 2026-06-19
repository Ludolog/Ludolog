import { DEMO_USER_ID } from "@/lib/config";
import {
  addWatchlistItem,
  appendPlayerSnapshot,
  appendPriceSnapshot,
  checkTriggeredAlerts,
  createPriceAlert,
  getAdminStatus,
  getBestDeals,
  getGameById,
  getGameBySteamAppId,
  getGameProfile,
  getGameSummary,
  getLatestPlayersBySteamAppId,
  getMostActiveGames,
  getOffersForGame,
  getPlayerHistory,
  getPriceHistory,
  importGameFromCatalog,
  listGames,
  listIntegrationLogs,
  listPriceAlerts,
  listWatchlist,
  recordIntegrationLog,
  removeWatchlistItem,
  searchGames
} from "@/lib/store";
import type {
  AlertRepository,
  AppRepositories,
  DiagnosticsRepository,
  GameRepository,
  SnapshotRepository,
  WatchlistRepository
} from "@/lib/repositories/contracts";
import type { GameImportInput, GamePriceSnapshot, PlayerCountSnapshot } from "@/lib/types";

class MockGameRepository implements GameRepository {
  async list() {
    return listGames();
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
    watchlist: new MockWatchlistRepository(),
    alerts: new MockAlertRepository(),
    snapshots: new MockSnapshotRepository(),
    diagnostics: new MockDiagnosticsRepository()
  };
}
