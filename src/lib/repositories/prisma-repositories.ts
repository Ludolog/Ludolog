import { Prisma } from "@prisma/client";

import { DEMO_USER_ID, getDataMode } from "@/lib/config";
import { prisma } from "@/lib/repositories/prisma-client";
import type {
  AlertRepository,
  AppRepositories,
  DiagnosticsRepository,
  GameRepository,
  SnapshotRepository,
  WatchlistRepository
} from "@/lib/repositories/contracts";
import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import type {
  AdminStatus,
  DataSource,
  Game,
  GamePriceSnapshot,
  GameProfile,
  GameSummary,
  IntegrationLog,
  PlayerCountSnapshot,
  PriceAlert,
  StoreOffer,
  WatchlistItem
} from "@/lib/types";

type PrismaGame = Prisma.GameGetPayload<Record<string, never>>;
type PrismaOffer = Prisma.StoreOfferGetPayload<Record<string, never>>;
type PrismaPrice = Prisma.GamePriceSnapshotGetPayload<Record<string, never>>;
type PrismaPlayers = Prisma.PlayerCountSnapshotGetPayload<Record<string, never>>;
type PrismaWatchlist = Prisma.WatchlistGetPayload<Record<string, never>>;
type PrismaAlert = Prisma.PriceAlertGetPayload<Record<string, never>>;
type PrismaLog = Prisma.IntegrationLogGetPayload<Record<string, never>>;

function sourceFromPrisma(source: string): DataSource {
  if (source === "steam_api") {
    return "steam-api";
  }
  if (source === "price_api") {
    return "price-api";
  }
  return source as DataSource;
}

function sourceToPrisma(source: DataSource): "mock" | "steam_api" | "price_api" | "prisma" {
  if (source === "steam-api") {
    return "steam_api";
  }
  if (source === "price-api") {
    return "price_api";
  }
  return source;
}

function mapGame(game: PrismaGame): Game {
  return {
    id: game.id,
    steamAppId: game.steamAppId,
    title: game.title,
    slug: game.slug,
    platform: game.platform,
    description: game.description,
    coverUrl: game.coverUrl,
    genres: game.genres,
    developer: game.developer,
    publisher: game.publisher,
    releaseDate: game.releaseDate.toISOString().slice(0, 10),
    reviewScore: game.reviewScore,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt
  };
}

function mapOffer(offer: PrismaOffer): StoreOffer {
  return {
    id: offer.id,
    gameId: offer.gameId,
    storeName: offer.storeName,
    price: Number(offer.price),
    currency: offer.currency,
    discountPercent: offer.discountPercent,
    url: offer.url,
    isOfficial: offer.isOfficial,
    drm: offer.drm,
    updatedAt: offer.updatedAt,
    source: sourceFromPrisma(offer.source)
  };
}

function mapPrice(snapshot: PrismaPrice): GamePriceSnapshot {
  return {
    id: snapshot.id,
    gameId: snapshot.gameId,
    price: Number(snapshot.price),
    historicalLow: Number(snapshot.historicalLow),
    basePrice: Number(snapshot.basePrice),
    discountPercent: snapshot.discountPercent,
    storeName: snapshot.storeName,
    currency: snapshot.currency,
    capturedAt: snapshot.capturedAt,
    source: sourceFromPrisma(snapshot.source)
  };
}

function mapPlayers(snapshot: PrismaPlayers): PlayerCountSnapshot {
  return {
    id: snapshot.id,
    gameId: snapshot.gameId,
    steamAppId: snapshot.steamAppId,
    playersOnline: snapshot.playersOnline,
    capturedAt: snapshot.capturedAt,
    source: sourceFromPrisma(snapshot.source)
  };
}

function mapWatchlist(item: PrismaWatchlist): WatchlistItem {
  return {
    id: item.id,
    userId: item.userId,
    gameId: item.gameId,
    targetPrice: item.targetPrice === null ? null : Number(item.targetPrice),
    alertEnabled: item.alertEnabled,
    createdAt: item.createdAt
  };
}

function mapAlert(alert: PrismaAlert): PriceAlert {
  return {
    id: alert.id,
    userId: alert.userId,
    gameId: alert.gameId,
    thresholdPrice: Number(alert.thresholdPrice),
    isActive: alert.isActive,
    triggeredAt: alert.triggeredAt,
    createdAt: alert.createdAt
  };
}

function mapLog(log: PrismaLog): IntegrationLog {
  return {
    id: log.id,
    service: log.service,
    level: log.level,
    message: log.message,
    createdAt: log.createdAt
  };
}

async function latestByGame<T extends { capturedAt: Date }>(items: T[]): Promise<T | null> {
  return [...items].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0] ?? null;
}

class PrismaGameRepository implements GameRepository {
  async list(): Promise<Game[]> {
    const games = await prisma.game.findMany({ orderBy: { title: "asc" } });
    return games.map(mapGame);
  }

  async findById(id: string): Promise<Game | null> {
    const game = await prisma.game.findFirst({
      where: { OR: [{ id }, { slug: id }] }
    });
    return game ? mapGame(game) : null;
  }

  async search(query: string): Promise<GameSummary[]> {
    const normalized = query.trim();
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { title: { contains: normalized, mode: "insensitive" } },
          { slug: { contains: normalized, mode: "insensitive" } }
        ]
      },
      orderBy: { title: "asc" }
    });
    const summaries = await Promise.all(games.map((game) => this.summaryForGame(mapGame(game))));
    return summaries.filter((summary): summary is GameSummary => summary !== null).sort((a, b) => b.score.score - a.score.score);
  }

  async getSummary(id: string): Promise<GameSummary | null> {
    const game = await this.findById(id);
    return game ? this.summaryForGame(game) : null;
  }

  async getProfile(id: string): Promise<GameProfile | null> {
    const summary = await this.getSummary(id);
    if (!summary) {
      return null;
    }

    const [priceHistory, playerHistory, offers] = await Promise.all([
      new PrismaSnapshotRepository().listPrices(summary.game.id),
      new PrismaSnapshotRepository().listPlayers(summary.game.id),
      this.listOffers(summary.game.id)
    ]);
    const historicalLow = priceHistory.length > 0 ? Math.min(...priceHistory.map((snapshot) => snapshot.historicalLow)) : null;
    const priceDeltaPercent =
      summary.latestPrice && historicalLow !== null && historicalLow > 0
        ? Math.round(((summary.latestPrice.price - historicalLow) / historicalLow) * 1000) / 10
        : summary.latestPrice?.price === 0
          ? 0
          : null;

    return {
      ...summary,
      priceHistory,
      playerHistory,
      offers,
      historicalLow,
      priceDeltaPercent
    };
  }

  async bestDeals(limit = 5): Promise<GameSummary[]> {
    const games = await this.list();
    const summaries = await Promise.all(games.map((game) => this.summaryForGame(game)));
    return summaries
      .filter((summary): summary is GameSummary => summary !== null)
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, limit);
  }

  async mostActive(limit = 5): Promise<GameSummary[]> {
    const games = await this.list();
    const summaries = await Promise.all(games.map((game) => this.summaryForGame(game)));
    return summaries
      .filter((summary): summary is GameSummary => summary !== null)
      .sort((a, b) => (b.latestPlayers?.playersOnline ?? 0) - (a.latestPlayers?.playersOnline ?? 0))
      .slice(0, limit);
  }

  async listOffers(gameId: string): Promise<StoreOffer[]> {
    const offers = await prisma.storeOffer.findMany({ where: { gameId }, orderBy: { price: "asc" } });
    return offers.map(mapOffer);
  }

  private async summaryForGame(game: Game): Promise<GameSummary | null> {
    const snapshotRepository = new PrismaSnapshotRepository();
    const [priceHistory, playerHistory, offers] = await Promise.all([
      snapshotRepository.listPrices(game.id),
      snapshotRepository.listPlayers(game.id),
      this.listOffers(game.id)
    ]);
    const latestPrice = await latestByGame(priceHistory);
    const latestPlayers = await latestByGame(playerHistory);
    const bestOffer = offers[0] ?? null;

    return {
      game,
      latestPrice,
      latestPlayers,
      bestOffer,
      score: calculateGameValueScore({
        latestPrice,
        priceHistory,
        latestPlayers,
        playerHistory,
        offers,
        reviewScore: game.reviewScore
      })
    };
  }
}

class PrismaWatchlistRepository implements WatchlistRepository {
  async list(userId = DEMO_USER_ID) {
    const items = await prisma.watchlist.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    const games = new PrismaGameRepository();
    return Promise.all(items.map(async (item) => ({ ...mapWatchlist(item), summary: await games.getSummary(item.gameId) })));
  }

  async add(gameId: string, targetPrice?: number | null, userId = DEMO_USER_ID): Promise<WatchlistItem> {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: "demo@gamevalueradar.local", name: "Demo user" }
    });
    const item = await prisma.watchlist.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: {
        targetPrice: targetPrice ?? undefined,
        alertEnabled: targetPrice !== undefined ? targetPrice !== null : undefined
      },
      create: {
        id: `watch-${gameId}-${Date.now()}`,
        userId,
        gameId,
        targetPrice: targetPrice ?? null,
        alertEnabled: targetPrice !== undefined && targetPrice !== null
      }
    });
    return mapWatchlist(item);
  }

  async remove(id: string, userId = DEMO_USER_ID): Promise<boolean> {
    const result = await prisma.watchlist.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}

class PrismaAlertRepository implements AlertRepository {
  async create(gameId: string, thresholdPrice: number, userId = DEMO_USER_ID): Promise<PriceAlert> {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: "demo@gamevalueradar.local", name: "Demo user" }
    });
    const alert = await prisma.priceAlert.create({
      data: {
        id: `alert-${gameId}-${Date.now()}`,
        userId,
        gameId,
        thresholdPrice
      }
    });
    return mapAlert(alert);
  }

  async list(userId = DEMO_USER_ID): Promise<PriceAlert[]> {
    const alerts = await prisma.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return alerts.map(mapAlert);
  }

  async checkTriggered(): Promise<PriceAlert[]> {
    const activeAlerts = await prisma.priceAlert.findMany({ where: { isActive: true } });
    const triggered: PriceAlert[] = [];

    for (const alert of activeAlerts) {
      const latestPrice = await prisma.gamePriceSnapshot.findFirst({
        where: { gameId: alert.gameId },
        orderBy: { capturedAt: "desc" }
      });
      if (latestPrice && Number(latestPrice.price) <= Number(alert.thresholdPrice)) {
        const updated = await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { isActive: false, triggeredAt: new Date() }
        });
        triggered.push(mapAlert(updated));
      }
    }

    return triggered;
  }
}

class PrismaSnapshotRepository implements SnapshotRepository {
  async listPrices(gameId: string): Promise<GamePriceSnapshot[]> {
    const snapshots = await prisma.gamePriceSnapshot.findMany({ where: { gameId }, orderBy: { capturedAt: "asc" } });
    return snapshots.map(mapPrice);
  }

  async listPlayers(gameId: string): Promise<PlayerCountSnapshot[]> {
    const snapshots = await prisma.playerCountSnapshot.findMany({ where: { gameId }, orderBy: { capturedAt: "asc" } });
    return snapshots.map(mapPlayers);
  }

  async latestPlayersBySteamAppId(steamAppId: number): Promise<PlayerCountSnapshot | null> {
    const snapshot = await prisma.playerCountSnapshot.findFirst({
      where: { steamAppId },
      orderBy: { capturedAt: "desc" }
    });
    return snapshot ? mapPlayers(snapshot) : null;
  }

  async appendPrice(snapshot: GamePriceSnapshot): Promise<void> {
    await prisma.gamePriceSnapshot.create({
      data: {
        ...snapshot,
        price: snapshot.price,
        historicalLow: snapshot.historicalLow,
        basePrice: snapshot.basePrice,
        source: sourceToPrisma(snapshot.source)
      }
    });
  }

  async appendPlayers(snapshot: PlayerCountSnapshot): Promise<void> {
    await prisma.playerCountSnapshot.create({
      data: {
        ...snapshot,
        source: sourceToPrisma(snapshot.source)
      }
    });
  }
}

class PrismaDiagnosticsRepository implements DiagnosticsRepository {
  async recordIntegrationLog(log: Omit<IntegrationLog, "id" | "createdAt">): Promise<IntegrationLog> {
    const entry = await prisma.integrationLog.create({
      data: {
        id: `log-${Date.now()}`,
        service: log.service,
        level: log.level,
        message: log.message
      }
    });
    return mapLog(entry);
  }

  async listIntegrationLogs(limit = 20): Promise<IntegrationLog[]> {
    const logs = await prisma.integrationLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return logs.map(mapLog);
  }

  async getAdminStatus(): Promise<AdminStatus> {
    const [gameCount, offerCount, priceSnapshotCount, playerSnapshotCount, watchlistCount, alertCount, integrationLogs] =
      await Promise.all([
        prisma.game.count(),
        prisma.storeOffer.count(),
        prisma.gamePriceSnapshot.count(),
        prisma.playerCountSnapshot.count(),
        prisma.watchlist.count(),
        prisma.priceAlert.count(),
        this.listIntegrationLogs()
      ]);

    return {
      mode: getDataMode(),
      gameCount,
      offerCount,
      priceSnapshotCount,
      playerSnapshotCount,
      watchlistCount,
      alertCount,
      integrationLogs
    };
  }
}

export function createPrismaRepositories(): AppRepositories {
  return {
    provider: "prisma",
    games: new PrismaGameRepository(),
    watchlist: new PrismaWatchlistRepository(),
    alerts: new PrismaAlertRepository(),
    snapshots: new PrismaSnapshotRepository(),
    diagnostics: new PrismaDiagnosticsRepository()
  };
}
