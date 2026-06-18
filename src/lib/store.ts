import { DEMO_USER_ID, getDataMode } from "@/lib/config";
import {
  mockGames,
  mockPlayerSnapshots,
  mockPriceAlerts,
  mockPriceSnapshots,
  mockStoreOffers,
  mockUsers,
  mockWatchlistItems
} from "@/lib/mock-data";
import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import type {
  AdminStatus,
  Game,
  GamePriceSnapshot,
  GameProfile,
  GameSummary,
  IntegrationLog,
  PlayerCountSnapshot,
  PriceAlert,
  StoreOffer,
  User,
  WatchlistItem
} from "@/lib/types";

const games: Game[] = [...mockGames];
const storeOffers: StoreOffer[] = [...mockStoreOffers];
const priceSnapshots: GamePriceSnapshot[] = [...mockPriceSnapshots];
const playerSnapshots: PlayerCountSnapshot[] = [...mockPlayerSnapshots];
const users: User[] = [...mockUsers];
const watchlistItems: WatchlistItem[] = [...mockWatchlistItems];
const priceAlerts: PriceAlert[] = [...mockPriceAlerts];
const integrationLogs: IntegrationLog[] = [
  {
    id: "log-mock-mode",
    service: "snapshot",
    level: "info",
    message: "Application started in mock-ready mode.",
    createdAt: new Date("2026-06-18T12:00:00.000Z")
  }
];

function latestByDate<T extends { capturedAt: Date }>(items: T[]): T | null {
  return [...items].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0] ?? null;
}

function latestOffer(gameId: string): StoreOffer | null {
  return [...storeOffers]
    .filter((offer) => offer.gameId === gameId)
    .sort((a, b) => a.price - b.price)[0] ?? null;
}

function priceHistory(gameId: string): GamePriceSnapshot[] {
  return priceSnapshots
    .filter((snapshot) => snapshot.gameId === gameId)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

function playerHistory(gameId: string): PlayerCountSnapshot[] {
  return playerSnapshots
    .filter((snapshot) => snapshot.gameId === gameId)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

export function listGames(): Game[] {
  return [...games].sort((a, b) => a.title.localeCompare(b.title));
}

export function getGameById(id: string): Game | null {
  return games.find((game) => game.id === id || game.slug === id) ?? null;
}

export function searchGames(query: string): GameSummary[] {
  const normalized = query.trim().toLowerCase();

  return games
    .filter((game) => {
      const text = `${game.title} ${game.slug} ${game.genres.join(" ")}`.toLowerCase();
      return text.includes(normalized);
    })
    .map(getGameSummary)
    .filter((summary): summary is GameSummary => summary !== null)
    .sort((a, b) => b.score.score - a.score.score);
}

export function getGameSummary(game: Game): GameSummary;
export function getGameSummary(gameId: string): GameSummary | null;
export function getGameSummary(gameOrId: Game | string): GameSummary | null {
  const game = typeof gameOrId === "string" ? getGameById(gameOrId) : gameOrId;
  if (!game) {
    return null;
  }

  const prices = priceHistory(game.id);
  const players = playerHistory(game.id);
  const offers = getOffersForGame(game.id);
  const latestPrice = latestByDate(prices);
  const latestPlayers = latestByDate(players);
  const bestOffer = latestOffer(game.id);

  return {
    game,
    latestPrice,
    latestPlayers,
    bestOffer,
    score: calculateGameValueScore({
      latestPrice,
      priceHistory: prices,
      latestPlayers,
      playerHistory: players,
      offers,
      reviewScore: game.reviewScore
    })
  };
}

export function getGameProfile(gameId: string): GameProfile | null {
  const summary = getGameSummary(gameId);
  if (!summary) {
    return null;
  }

  const prices = priceHistory(summary.game.id);
  const players = playerHistory(summary.game.id);
  const offers = getOffersForGame(summary.game.id);
  const historicalLow = prices.length > 0 ? Math.min(...prices.map((snapshot) => snapshot.historicalLow)) : null;
  const priceDeltaPercent =
    summary.latestPrice && historicalLow !== null && historicalLow > 0
      ? Math.round(((summary.latestPrice.price - historicalLow) / historicalLow) * 1000) / 10
      : summary.latestPrice?.price === 0
        ? 0
        : null;

  return {
    ...summary,
    priceHistory: prices,
    playerHistory: players,
    offers,
    historicalLow,
    priceDeltaPercent
  };
}

export function getBestDeals(limit = 5): GameSummary[] {
  return games
    .map(getGameSummary)
    .filter((summary): summary is GameSummary => summary !== null)
    .sort((a, b) => {
      const priceBias = (b.latestPrice?.discountPercent ?? 0) - (a.latestPrice?.discountPercent ?? 0);
      return b.score.score - a.score.score || priceBias;
    })
    .slice(0, limit);
}

export function getMostActiveGames(limit = 5): GameSummary[] {
  return games
    .map(getGameSummary)
    .filter((summary): summary is GameSummary => summary !== null)
    .sort((a, b) => (b.latestPlayers?.playersOnline ?? 0) - (a.latestPlayers?.playersOnline ?? 0))
    .slice(0, limit);
}

export function getOffersForGame(gameId: string): StoreOffer[] {
  return storeOffers
    .filter((offer) => offer.gameId === gameId)
    .sort((a, b) => a.price - b.price);
}

export function getPriceHistory(gameId: string): GamePriceSnapshot[] {
  return priceHistory(gameId);
}

export function getPlayerHistory(gameId: string): PlayerCountSnapshot[] {
  return playerHistory(gameId);
}

export function getLatestPlayersBySteamAppId(steamAppId: number): PlayerCountSnapshot | null {
  return latestByDate(playerSnapshots.filter((snapshot) => snapshot.steamAppId === steamAppId));
}

export function appendPriceSnapshot(snapshot: GamePriceSnapshot): void {
  priceSnapshots.push(snapshot);
}

export function appendPlayerSnapshot(snapshot: PlayerCountSnapshot): void {
  playerSnapshots.push(snapshot);
}

export function listWatchlist(userId = DEMO_USER_ID): Array<WatchlistItem & { summary: GameSummary | null }> {
  return watchlistItems
    .filter((item) => item.userId === userId)
    .map((item) => ({ ...item, summary: getGameSummary(item.gameId) }));
}

export function addWatchlistItem(gameId: string, targetPrice?: number | null, userId = DEMO_USER_ID): WatchlistItem {
  const existing = watchlistItems.find((item) => item.userId === userId && item.gameId === gameId);
  if (existing) {
    existing.targetPrice = targetPrice ?? existing.targetPrice;
    existing.alertEnabled = targetPrice !== undefined ? targetPrice !== null : existing.alertEnabled;
    return existing;
  }

  const item: WatchlistItem = {
    id: `watch-${gameId}-${Date.now()}`,
    userId,
    gameId,
    targetPrice: targetPrice ?? null,
    alertEnabled: targetPrice !== undefined && targetPrice !== null,
    createdAt: new Date()
  };
  watchlistItems.push(item);
  return item;
}

export function removeWatchlistItem(id: string, userId = DEMO_USER_ID): boolean {
  const index = watchlistItems.findIndex((item) => item.id === id && item.userId === userId);
  if (index === -1) {
    return false;
  }

  watchlistItems.splice(index, 1);
  return true;
}

export function createPriceAlert(
  gameId: string,
  thresholdPrice: number,
  userId = DEMO_USER_ID
): PriceAlert {
  const alert: PriceAlert = {
    id: `alert-${gameId}-${Date.now()}`,
    userId,
    gameId,
    thresholdPrice,
    isActive: true,
    triggeredAt: null,
    createdAt: new Date()
  };
  priceAlerts.push(alert);
  return alert;
}

export function listPriceAlerts(userId = DEMO_USER_ID): PriceAlert[] {
  return priceAlerts.filter((alert) => alert.userId === userId);
}

export function checkTriggeredAlerts(): PriceAlert[] {
  const triggered: PriceAlert[] = [];

  for (const alert of priceAlerts) {
    if (!alert.isActive) {
      continue;
    }

    const latestPrice = latestByDate(priceHistory(alert.gameId));
    if (latestPrice && latestPrice.price <= alert.thresholdPrice) {
      alert.triggeredAt = new Date();
      alert.isActive = false;
      triggered.push(alert);
    }
  }

  return triggered;
}

export function recordIntegrationLog(log: Omit<IntegrationLog, "id" | "createdAt">): IntegrationLog {
  const entry: IntegrationLog = {
    ...log,
    id: `log-${Date.now()}-${integrationLogs.length + 1}`,
    createdAt: new Date()
  };
  integrationLogs.unshift(entry);
  return entry;
}

export function listIntegrationLogs(limit = 20): IntegrationLog[] {
  return integrationLogs.slice(0, limit);
}

export function listUsers(): User[] {
  return [...users];
}

export function getAdminStatus(): AdminStatus {
  return {
    mode: getDataMode(),
    gameCount: games.length,
    offerCount: storeOffers.length,
    priceSnapshotCount: priceSnapshots.length,
    playerSnapshotCount: playerSnapshots.length,
    watchlistCount: watchlistItems.length,
    alertCount: priceAlerts.length,
    integrationLogs: listIntegrationLogs()
  };
}
