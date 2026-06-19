import { Prisma } from "@prisma/client";

import { DEMO_USER_ID, getDataMode, getGGDealsApiKey, getPriceMode, getPriceProvider } from "@/lib/config";
import { prisma } from "@/lib/repositories/prisma-client";
import type {
  AlertRepository,
  AppRepositories,
  DiagnosticsRepository,
  GameRepository,
  PriceRepository,
  SnapshotRepository,
  SteamCatalogRepository,
  SteamCatalogUpsertInput,
  WatchlistRepository
} from "@/lib/repositories/contracts";
import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import { resolveGGDealsStatusFromLogs } from "@/lib/services/ggdeals-diagnostics";
import type {
  AdminStatus,
  DataSource,
  Game,
  GameImportInput,
  GamePriceSnapshot,
  GameProfile,
  GameSummary,
  IntegrationLog,
  PlayerCountSnapshot,
  PriceAlert,
  PriceSource,
  PriceSourceType,
  SteamCatalogEntry,
  Store,
  StoreOffer,
  StoreType,
  WatchlistItem
} from "@/lib/types";

type PrismaGame = Prisma.GameGetPayload<Record<string, never>>;
type PrismaOffer = Prisma.StoreOfferGetPayload<Record<string, never>>;
type PrismaPrice = Prisma.GamePriceSnapshotGetPayload<Record<string, never>>;
type PrismaPlayers = Prisma.PlayerCountSnapshotGetPayload<Record<string, never>>;
type PrismaSteamCatalogEntry = Prisma.SteamCatalogEntryGetPayload<Record<string, never>>;
type PrismaWatchlist = Prisma.WatchlistGetPayload<Record<string, never>>;
type PrismaAlert = Prisma.PriceAlertGetPayload<Record<string, never>>;
type PrismaLog = Prisma.IntegrationLogGetPayload<Record<string, never>>;
type PrismaStore = Prisma.StoreGetPayload<Record<string, never>>;
type PrismaPriceSource = Prisma.PriceSourceGetPayload<Record<string, never>>;

function sourceFromPrisma(source: string): DataSource {
  if (source === "steam_api") {
    return "steam-api";
  }
  if (source === "price_api") {
    return "price-api";
  }
  return source as DataSource;
}

function sourceToPrisma(source: DataSource): "mock" | "steam_api" | "price_api" | "prisma" | "ggdeals" | "manual" {
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
    source: sourceFromPrisma(game.source),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt
  };
}

function mapSteamCatalogEntry(entry: PrismaSteamCatalogEntry): SteamCatalogEntry {
  return {
    id: entry.id,
    steamAppId: entry.steamAppId,
    title: entry.title,
    appType: entry.appType,
    lastModified: entry.lastModified,
    priceChangeNumber: entry.priceChangeNumber,
    isGame: entry.isGame,
    isActive: entry.isActive,
    source: sourceFromPrisma(entry.source),
    syncedAt: entry.syncedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function mapOffer(offer: PrismaOffer): StoreOffer {
  return {
    id: offer.id,
    gameId: offer.gameId,
    steamAppId: offer.steamAppId,
    storeId: offer.storeId,
    sourceId: offer.sourceId,
    provider: offer.provider,
    storeName: offer.storeName,
    storeType: offer.storeType as StoreOffer["storeType"],
    title: offer.title,
    price: Number(offer.price),
    regularPrice: offer.regularPrice === null ? null : Number(offer.regularPrice),
    historicalLow: offer.historicalLow === null ? null : Number(offer.historicalLow),
    currency: offer.currency,
    discountPercent: offer.discountPercent,
    url: offer.url,
    externalUrl: offer.externalUrl,
    region: offer.region,
    isOfficial: offer.isOfficial,
    isOfficialStore: offer.isOfficialStore,
    isHistoricalLow: offer.isHistoricalLow,
    available: offer.available,
    drm: offer.drm,
    platform: offer.platform,
    sourceRawId: offer.sourceRawId,
    rawProviderData: offer.rawProviderData,
    fetchedAt: offer.fetchedAt,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    source: sourceFromPrisma(offer.source),
    sourceConfidence: sourceConfidence(sourceFromPrisma(offer.source))
  };
}

function mapPrice(snapshot: PrismaPrice): GamePriceSnapshot {
  return {
    id: snapshot.id,
    gameId: snapshot.gameId,
    steamAppId: snapshot.steamAppId,
    sourceId: snapshot.sourceId,
    provider: snapshot.provider,
    storeType: snapshot.storeType as GamePriceSnapshot["storeType"],
    price: Number(snapshot.price),
    bestPrice: Number(snapshot.price),
    historicalLow: Number(snapshot.historicalLow),
    basePrice: Number(snapshot.basePrice),
    discountPercent: snapshot.discountPercent,
    storeName: snapshot.storeName,
    currency: snapshot.currency,
    externalUrl: snapshot.externalUrl,
    offerCount: snapshot.offerCount,
    isHistoricalLow: snapshot.isHistoricalLow,
    sourceRawId: snapshot.sourceRawId,
    rawProviderData: snapshot.rawProviderData,
    fetchedAt: snapshot.fetchedAt,
    capturedAt: snapshot.capturedAt,
    createdAt: snapshot.createdAt,
    source: sourceFromPrisma(snapshot.source),
    sourceConfidence: sourceConfidence(sourceFromPrisma(snapshot.source))
  };
}

function mapStore(store: PrismaStore): Store {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    storeType: store.storeType as StoreType,
    websiteUrl: store.websiteUrl,
    isActive: store.isActive,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt
  };
}

function mapPriceSource(source: PrismaPriceSource): PriceSource {
  return {
    id: source.id,
    name: source.name,
    type: source.type as PriceSourceType,
    isActive: source.isActive,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  };
}

function sourceConfidence(source: DataSource): StoreOffer["sourceConfidence"] {
  if (source === "mock") {
    return "internal-mock";
  }
  if (source === "manual" || source === "prisma") {
    return "internal-real";
  }
  if (source === "ggdeals" || source === "price-api") {
    return "external-legacy";
  }
  return "no-price-data";
}

function compareOffers(a: StoreOffer, b: StoreOffer): number {
  const priceDiff = a.price - b.price;
  if (priceDiff !== 0) {
    return priceDiff;
  }
  const confidenceDiff = sourceConfidenceRank(a.sourceConfidence) - sourceConfidenceRank(b.sourceConfidence);
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function sourceConfidenceRank(source: StoreOffer["sourceConfidence"]): number {
  if (source === "internal-real") {
    return 0;
  }
  if (source === "external-legacy") {
    return 1;
  }
  if (source === "internal-mock") {
    return 2;
  }
  return 3;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
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

  async listImported(limit = 50): Promise<Game[]> {
    const games = await prisma.game.findMany({
      where: { source: { not: "mock" } },
      orderBy: { updatedAt: "desc" },
      take: limit
    });
    return games.map(mapGame);
  }

  async findById(id: string): Promise<Game | null> {
    const game = await prisma.game.findFirst({
      where: { OR: [{ id }, { slug: id }] }
    });
    return game ? mapGame(game) : null;
  }

  async findBySteamAppId(steamAppId: number): Promise<Game | null> {
    const game = await prisma.game.findUnique({ where: { steamAppId } });
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

  async importFromCatalog(input: GameImportInput): Promise<GameSummary> {
    const existing = await this.findBySteamAppId(input.steamAppId);
    if (existing) {
      const summary = await this.summaryForGame(existing);
      if (summary) {
        return summary;
      }
    }

    const now = new Date();
    const game = await prisma.game.upsert({
      where: { steamAppId: input.steamAppId },
      update: {
        title: input.title,
        slug: input.slug,
        platform: input.platform,
        description: input.description,
        coverUrl: input.coverUrl,
        genres: input.genres,
        developer: input.developer,
        publisher: input.publisher,
        releaseDate: new Date(input.releaseDate),
        reviewScore: input.reviewScore,
        source: sourceToPrisma(input.source)
      },
      create: {
        id: input.id,
        steamAppId: input.steamAppId,
        title: input.title,
        slug: input.slug,
        platform: input.platform,
        description: input.description,
        coverUrl: input.coverUrl,
        genres: input.genres,
        developer: input.developer,
        publisher: input.publisher,
        releaseDate: new Date(input.releaseDate),
        reviewScore: input.reviewScore,
        source: sourceToPrisma(input.source),
        createdAt: now,
        updatedAt: now
      }
    });

    const gameId = game.id;
    await new PrismaPriceRepository().upsertPriceSource({ name: "mock-seed", type: "mock" });
    await new PrismaPriceRepository().upsertStore({
      name: "Steam",
      slug: "steam",
      storeType: "official",
      websiteUrl: "https://store.steampowered.com/"
    });
    const discountPercent =
      input.basePrice === 0 ? 0 : Math.max(0, Math.round((1 - input.currentPrice / input.basePrice) * 100));
    await prisma.storeOffer.upsert({
      where: { id: `offer-${input.id}-import-steam` },
      update: {
        steamAppId: input.steamAppId,
        storeId: "store-steam",
        sourceId: "price-source-mock-seed",
        title: input.title,
        price: input.currentPrice,
        discountPercent,
        regularPrice: input.basePrice,
        historicalLow: input.historicalLow,
        isHistoricalLow: input.currentPrice <= input.historicalLow,
        isOfficialStore: true,
        available: true,
        region: "PL",
        platform: input.platform,
        fetchedAt: now,
        updatedAt: now
      },
      create: {
        id: `offer-${input.id}-import-steam`,
        gameId,
        steamAppId: input.steamAppId,
        storeId: "store-steam",
        sourceId: "price-source-mock-seed",
        provider: "mock",
        storeName: "Steam",
        storeType: "official",
        title: input.title,
        price: input.currentPrice,
        regularPrice: input.basePrice,
        historicalLow: input.historicalLow,
        currency: "PLN",
        discountPercent,
        url: `https://store.steampowered.com/app/${input.steamAppId}`,
        externalUrl: `https://store.steampowered.com/app/${input.steamAppId}`,
        region: "PL",
        isOfficial: true,
        isOfficialStore: true,
        isHistoricalLow: input.currentPrice <= input.historicalLow,
        available: true,
        drm: "Steam",
        platform: input.platform,
        fetchedAt: now,
        createdAt: now,
        source: "mock",
        updatedAt: now
      }
    });

    await prisma.gamePriceSnapshot.create({
      data: {
        id: `price-${input.id}-import-${now.getTime()}`,
        gameId,
        steamAppId: input.steamAppId,
        sourceId: "price-source-mock-seed",
        price: input.currentPrice,
        historicalLow: input.historicalLow,
        basePrice: input.basePrice,
        discountPercent,
        provider: "mock",
        storeType: "official",
        storeName: "Steam",
        currency: "PLN",
        externalUrl: `https://store.steampowered.com/app/${input.steamAppId}`,
        offerCount: 1,
        isHistoricalLow: input.currentPrice <= input.historicalLow,
        fetchedAt: now,
        capturedAt: now,
        createdAt: now,
        source: "mock"
      }
    });

    const previousPlayers = Math.max(0, Math.round(input.currentPlayers / Math.max(input.trendFactor, 0.1)));
    await prisma.playerCountSnapshot.createMany({
      data: [
        {
          id: `players-${input.id}-import-previous-${now.getTime()}`,
          gameId,
          steamAppId: input.steamAppId,
          playersOnline: previousPlayers,
          capturedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          source: "mock"
        },
        {
          id: `players-${input.id}-import-current-${now.getTime()}`,
          gameId,
          steamAppId: input.steamAppId,
          playersOnline: input.currentPlayers,
          capturedAt: now,
          source: "mock"
        }
      ]
    });

    const summary = await this.getSummary(gameId);
    if (!summary) {
      throw new Error(`Imported game ${input.title} could not be summarized.`);
    }
    return summary;
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
    const offers = await prisma.storeOffer.findMany({ where: { gameId } });
    return offers.map(mapOffer).sort(compareOffers);
  }

  async upsertOffers(gameId: string, offers: StoreOffer[]): Promise<void> {
    for (const offer of offers) {
      await prisma.storeOffer.upsert({
        where: { id: offer.id },
        update: {
          steamAppId: offer.steamAppId,
          storeId: offer.storeId,
          sourceId: offer.sourceId,
          provider: offer.provider,
          storeName: offer.storeName,
          storeType: offer.storeType,
          title: offer.title,
          price: offer.price,
          regularPrice: offer.regularPrice,
          historicalLow: offer.historicalLow,
          currency: offer.currency,
          discountPercent: offer.discountPercent,
          url: offer.url,
          externalUrl: offer.externalUrl,
          region: offer.region,
          isOfficial: offer.isOfficial,
          isOfficialStore: offer.isOfficialStore,
          isHistoricalLow: offer.isHistoricalLow,
          available: offer.available,
          drm: offer.drm,
          platform: offer.platform,
          sourceRawId: offer.sourceRawId,
          rawProviderData: offer.rawProviderData as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
          fetchedAt: offer.fetchedAt,
          createdAt: offer.createdAt,
          source: sourceToPrisma(offer.source),
          updatedAt: offer.updatedAt
        },
        create: {
          id: offer.id,
          gameId,
          steamAppId: offer.steamAppId,
          storeId: offer.storeId,
          sourceId: offer.sourceId,
          provider: offer.provider,
          storeName: offer.storeName,
          storeType: offer.storeType,
          title: offer.title,
          price: offer.price,
          regularPrice: offer.regularPrice,
          historicalLow: offer.historicalLow,
          currency: offer.currency,
          discountPercent: offer.discountPercent,
          url: offer.url,
          externalUrl: offer.externalUrl,
          region: offer.region,
          isOfficial: offer.isOfficial,
          isOfficialStore: offer.isOfficialStore,
          isHistoricalLow: offer.isHistoricalLow,
          available: offer.available,
          drm: offer.drm,
          platform: offer.platform,
          sourceRawId: offer.sourceRawId,
          rawProviderData: offer.rawProviderData as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
          fetchedAt: offer.fetchedAt,
          createdAt: offer.createdAt,
          source: sourceToPrisma(offer.source),
          updatedAt: offer.updatedAt
        }
      });
    }
  }

  async countOffersBySource(source: "mock" | "ggdeals" | "price-api" | "manual"): Promise<number> {
    return prisma.storeOffer.count({ where: { source: sourceToPrisma(source) } });
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

class PrismaSteamCatalogRepository implements SteamCatalogRepository {
  async search(query: string, limit = 12): Promise<SteamCatalogEntry[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const entries = await prisma.steamCatalogEntry.findMany({
      where: {
        isGame: true,
        isActive: true,
        title: { contains: trimmed, mode: "insensitive" }
      },
      orderBy: [{ title: "asc" }],
      take: limit
    });
    return entries.map(mapSteamCatalogEntry);
  }

  async findBySteamAppId(steamAppId: number): Promise<SteamCatalogEntry | null> {
    const entry = await prisma.steamCatalogEntry.findUnique({ where: { steamAppId } });
    return entry ? mapSteamCatalogEntry(entry) : null;
  }

  async upsertMany(entries: SteamCatalogUpsertInput[]) {
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = await prisma.steamCatalogEntry.findUnique({ where: { steamAppId: entry.steamAppId } });
      await prisma.steamCatalogEntry.upsert({
        where: { steamAppId: entry.steamAppId },
        update: {
          title: entry.title,
          appType: entry.appType,
          lastModified: entry.lastModified,
          priceChangeNumber: entry.priceChangeNumber,
          isGame: entry.isGame,
          isActive: entry.isActive,
          source: sourceToPrisma(entry.source),
          syncedAt: entry.syncedAt
        },
        create: {
          id: entry.id,
          steamAppId: entry.steamAppId,
          title: entry.title,
          appType: entry.appType,
          lastModified: entry.lastModified,
          priceChangeNumber: entry.priceChangeNumber,
          isGame: entry.isGame,
          isActive: entry.isActive,
          source: sourceToPrisma(entry.source),
          syncedAt: entry.syncedAt
        }
      });
      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return { created, updated };
  }

  async status() {
    const [entryCount, activeGameCount, latest, highestAppId] = await Promise.all([
      prisma.steamCatalogEntry.count(),
      prisma.steamCatalogEntry.count({ where: { isGame: true, isActive: true } }),
      prisma.steamCatalogEntry.findFirst({ orderBy: { syncedAt: "desc" } }),
      prisma.steamCatalogEntry.findFirst({ orderBy: { steamAppId: "desc" } })
    ]);

    return {
      entryCount,
      activeGameCount,
      lastSyncedAt: latest?.syncedAt ?? null,
      nextStartAfterAppId: highestAppId?.steamAppId ?? null
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

  async latestPlayerRefresh(): Promise<Date | null> {
    const snapshot = await prisma.playerCountSnapshot.findFirst({ orderBy: { capturedAt: "desc" } });
    return snapshot?.capturedAt ?? null;
  }

  async countPlayerSnapshotsBySource(source: "mock" | "steam-api"): Promise<number> {
    return prisma.playerCountSnapshot.count({ where: { source: sourceToPrisma(source) } });
  }

  async latestPriceRefresh(): Promise<Date | null> {
    const snapshot = await prisma.gamePriceSnapshot.findFirst({ orderBy: { capturedAt: "desc" } });
    return snapshot?.capturedAt ?? null;
  }

  async countPriceSnapshotsBySource(source: "mock" | "ggdeals" | "price-api" | "manual"): Promise<number> {
    return prisma.gamePriceSnapshot.count({ where: { source: sourceToPrisma(source) } });
  }

  async appendPrice(snapshot: GamePriceSnapshot): Promise<void> {
    await prisma.gamePriceSnapshot.create({
      data: {
        id: snapshot.id,
        gameId: snapshot.gameId,
        steamAppId: snapshot.steamAppId,
        sourceId: snapshot.sourceId,
        provider: snapshot.provider,
        storeType: snapshot.storeType,
        price: snapshot.price,
        historicalLow: snapshot.historicalLow,
        basePrice: snapshot.basePrice,
        discountPercent: snapshot.discountPercent,
        storeName: snapshot.storeName,
        currency: snapshot.currency,
        externalUrl: snapshot.externalUrl,
        offerCount: snapshot.offerCount,
        isHistoricalLow: snapshot.isHistoricalLow,
        sourceRawId: snapshot.sourceRawId,
        rawProviderData: snapshot.rawProviderData as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
        fetchedAt: snapshot.fetchedAt,
        capturedAt: snapshot.capturedAt,
        createdAt: snapshot.createdAt,
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

class PrismaPriceRepository implements PriceRepository {
  async upsertStore(input: {
    name: string;
    slug?: string;
    storeType: StoreType;
    websiteUrl?: string | null;
  }): Promise<{ store: Store; created: boolean }> {
    const slug = input.slug ?? slugify(input.name);
    const existing = await prisma.store.findUnique({ where: { slug } });
    const now = new Date();
    const store = await prisma.store.upsert({
      where: { slug },
      update: {
        name: input.name,
        storeType: input.storeType,
        websiteUrl: input.websiteUrl ?? undefined,
        updatedAt: now
      },
      create: {
        id: `store-${slug}`,
        name: input.name,
        slug,
        storeType: input.storeType,
        websiteUrl: input.websiteUrl ?? null,
        createdAt: now,
        updatedAt: now
      }
    });
    return { store: mapStore(store), created: existing === null };
  }

  async upsertPriceSource(input: {
    name: string;
    type: PriceSourceType;
  }): Promise<{ source: PriceSource; created: boolean }> {
    const existing = await prisma.priceSource.findUnique({ where: { name: input.name } });
    const now = new Date();
    const source = await prisma.priceSource.upsert({
      where: { name: input.name },
      update: {
        type: input.type,
        updatedAt: now
      },
      create: {
        id: `price-source-${slugify(input.name)}`,
        name: input.name,
        type: input.type,
        createdAt: now,
        updatedAt: now
      }
    });
    return { source: mapPriceSource(source), created: existing === null };
  }

  async listStores(): Promise<Store[]> {
    const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });
    return stores.map(mapStore);
  }

  async listPriceSources(): Promise<PriceSource[]> {
    const sources = await prisma.priceSource.findMany({ orderBy: { name: "asc" } });
    return sources.map(mapPriceSource);
  }

  async status() {
    const [
      offerCount,
      priceSnapshotCount,
      storeCount,
      priceSourceCount,
      latestPriceSnapshot,
      realInternalPriceSnapshots,
      mockPriceSnapshots,
      realOffers,
      mockOffers
    ] = await Promise.all([
      prisma.storeOffer.count(),
      prisma.gamePriceSnapshot.count(),
      prisma.store.count(),
      prisma.priceSource.count(),
      new PrismaSnapshotRepository().latestPriceRefresh(),
      new PrismaSnapshotRepository().countPriceSnapshotsBySource("manual"),
      new PrismaSnapshotRepository().countPriceSnapshotsBySource("mock"),
      new PrismaGameRepository().countOffersBySource("manual"),
      new PrismaGameRepository().countOffersBySource("mock")
    ]);
    return {
      offerCount,
      priceSnapshotCount,
      storeCount,
      priceSourceCount,
      lastPriceSnapshot: latestPriceSnapshot,
      realInternalPriceSnapshots,
      mockPriceSnapshots,
      realOffers,
      mockOffers
    };
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
    const [
      gameCount,
      importedGameCount,
      steamCatalogStatus,
      offerCount,
      priceSnapshotCount,
      storeCount,
      priceSourceCount,
      playerSnapshotCount,
      lastPlayerCountRefresh,
      watchlistCount,
      alertCount,
      integrationLogs
    ] =
      await Promise.all([
        prisma.game.count(),
        prisma.game.count({ where: { source: { not: "mock" } } }),
        new PrismaSteamCatalogRepository().status(),
        prisma.storeOffer.count(),
        prisma.gamePriceSnapshot.count(),
        prisma.store.count(),
        prisma.priceSource.count(),
        prisma.playerCountSnapshot.count(),
        new PrismaSnapshotRepository().latestPlayerRefresh(),
        prisma.watchlist.count(),
        prisma.priceAlert.count(),
        this.listIntegrationLogs()
      ]);
    const realInternalPriceSnapshots = await new PrismaSnapshotRepository().countPriceSnapshotsBySource("manual");
    const realPriceSnapshots =
      realInternalPriceSnapshots +
      (await new PrismaSnapshotRepository().countPriceSnapshotsBySource("ggdeals")) +
      (await new PrismaSnapshotRepository().countPriceSnapshotsBySource("price-api"));
    const realOffers =
      (await new PrismaGameRepository().countOffersBySource("manual")) +
      (await new PrismaGameRepository().countOffersBySource("ggdeals")) +
      (await new PrismaGameRepository().countOffersBySource("price-api"));
    const ggdealsRuntime = resolveGGDealsStatusFromLogs({
      hasApiKey: Boolean(getGGDealsApiKey()),
      logs: integrationLogs,
      realOffers,
      realPriceSnapshots
    });

    return {
      mode: getDataMode(),
      gameCount,
      steamCatalogEntryCount: steamCatalogStatus.entryCount,
      importedGameCount,
      lastSteamCatalogSync: steamCatalogStatus.lastSyncedAt,
      lastPlayerCountRefresh,
      offerCount,
      priceSnapshotCount,
      storeCount,
      priceSourceCount,
      playerSnapshotCount,
      watchlistCount,
      alertCount,
      priceProvider: getPriceProvider(),
      priceMode: getPriceMode(),
      hasGGDealsApiKey: Boolean(getGGDealsApiKey()),
      ggdealsStatus: ggdealsRuntime.status,
      lastGGDealsCheck: ggdealsRuntime.lastCheckedAt,
      lastPriceRefresh: await new PrismaSnapshotRepository().latestPriceRefresh(),
      realInternalPriceSnapshots,
      realPriceSnapshots,
      mockPriceSnapshots: await new PrismaSnapshotRepository().countPriceSnapshotsBySource("mock"),
      realOffers,
      mockOffers: await new PrismaGameRepository().countOffersBySource("mock"),
      realPlayerSnapshots: await new PrismaSnapshotRepository().countPlayerSnapshotsBySource("steam-api"),
      mockPlayerSnapshots: await new PrismaSnapshotRepository().countPlayerSnapshotsBySource("mock"),
      integrationLogs
    };
  }
}

export function createPrismaRepositories(): AppRepositories {
  return {
    provider: "prisma",
    games: new PrismaGameRepository(),
    steamCatalog: new PrismaSteamCatalogRepository(),
    prices: new PrismaPriceRepository(),
    watchlist: new PrismaWatchlistRepository(),
    alerts: new PrismaAlertRepository(),
    snapshots: new PrismaSnapshotRepository(),
    diagnostics: new PrismaDiagnosticsRepository()
  };
}
