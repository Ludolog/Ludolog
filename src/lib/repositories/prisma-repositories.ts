import { Prisma, type IntegrationService as PrismaIntegrationService } from "@prisma/client";

import {
  DEMO_USER_ID,
  getDataMode,
  getGGDealsApiKey,
  getGogCountryCode,
  getGogCurrency,
  getSteamStoreCountryCode,
  getSteamStoreCurrency,
  getSteamStorePriceCacheTtlMinutes,
  getSteamStorePriceMaxPerRun,
  getPriceMode,
  getPriceProvider,
  isSteamStorePriceEnabled,
  isGogEnabled
} from "@/lib/config";
import { prisma } from "@/lib/repositories/prisma-client";
import type {
  AlertRepository,
  AppRepositories,
  DiagnosticsRepository,
  GameRepository,
  GogRepository,
  MockPriceCleanupPreview,
  MockPriceCleanupRun,
  PriceRepository,
  PriceDataSource,
  SnapshotRepository,
  SteamCatalogRepository,
  SteamCatalogUpsertInput,
  WatchlistRepository
} from "@/lib/repositories/contracts";
import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import { resolveGGDealsStatusFromLogs } from "@/lib/services/ggdeals-diagnostics";
import {
  compareTrustedOffers,
  isTrustedPriceSource,
  sourceConfidenceForDataSource,
  trustedOffersOnly
} from "@/lib/services/price-source-utils";
import type {
  AdminStatus,
  DataSource,
  Game,
  GameExternalMapping,
  GameImportInput,
  GamePriceSnapshot,
  GameProfile,
  GameSummary,
  GogCatalogEntry,
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
type PrismaGogCatalogEntry = Prisma.GogCatalogEntryGetPayload<Record<string, never>>;
type PrismaGameExternalMapping = Prisma.GameExternalMappingGetPayload<Record<string, never>>;
type PrismaWatchlist = Prisma.WatchlistGetPayload<Record<string, never>>;
type PrismaAlert = Prisma.PriceAlertGetPayload<Record<string, never>>;
type PrismaLog = Prisma.IntegrationLogGetPayload<Record<string, never>>;
type PrismaStore = Prisma.StoreGetPayload<Record<string, never>>;
type PrismaPriceSource = Prisma.PriceSourceGetPayload<Record<string, never>>;

function sourceFromPrisma(source: string): DataSource {
  if (source === "steam_api") {
    return "steam-api";
  }
  if (source === "steam_store") {
    return "steam-store";
  }
  if (source === "price_api") {
    return "price-api";
  }
  return source as DataSource;
}

function sourceToPrisma(
  source: DataSource
): "mock" | "steam_api" | "steam_store" | "price_api" | "prisma" | "ggdeals" | "manual" | "gog" {
  if (source === "steam-api") {
    return "steam_api";
  }
  if (source === "steam-store") {
    return "steam_store";
  }
  if (source === "price-api") {
    return "price_api";
  }
  return source;
}

function logServiceFromPrisma(service: string): IntegrationLog["service"] {
  if (service === "steam_store") {
    return "steam-store";
  }
  if (service === "price_cleanup") {
    return "price-cleanup";
  }
  return service as IntegrationLog["service"];
}

function logServiceToPrisma(service: IntegrationLog["service"]): string {
  if (service === "steam-store") {
    return "steam_store";
  }
  if (service === "price-cleanup") {
    return "price_cleanup";
  }
  return service;
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

function mapGogCatalogEntry(entry: PrismaGogCatalogEntry): GogCatalogEntry {
  return {
    id: entry.id,
    gogProductId: entry.gogProductId,
    title: entry.title,
    slug: entry.slug,
    url: entry.url,
    imageUrl: entry.imageUrl,
    isActive: entry.isActive,
    productType: entry.productType,
    rawData: entry.rawData,
    syncedAt: entry.syncedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function mapGameExternalMapping(mapping: PrismaGameExternalMapping): GameExternalMapping {
  return {
    id: mapping.id,
    gameId: mapping.gameId,
    provider: mapping.provider,
    externalId: mapping.externalId,
    externalSlug: mapping.externalSlug,
    confidence: mapping.confidence as GameExternalMapping["confidence"],
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt
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
    sourceConfidence: sourceConfidence(sourceFromPrisma(offer.source)),
    sourceName: sourceName(sourceFromPrisma(offer.source)),
    sourceType: sourceType(sourceFromPrisma(offer.source))
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
    sourceConfidence: sourceConfidence(sourceFromPrisma(snapshot.source)),
    sourceName: sourceName(sourceFromPrisma(snapshot.source)),
    sourceType: sourceType(sourceFromPrisma(snapshot.source))
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
  return sourceConfidenceForDataSource(source);
}

function sourceName(source: DataSource): string {
  if (source === "manual") {
    return "manual-admin";
  }
  if (source === "gog") {
    return "gog";
  }
  if (source === "steam-store") {
    return "steam-store";
  }
  if (source === "ggdeals") {
    return "ggdeals";
  }
  if (source === "price-api") {
    return "legacy-price-api";
  }
  if (source === "mock") {
    return "mock-seed";
  }
  return source;
}

function sourceType(source: DataSource): StoreOffer["sourceType"] {
  if (source === "manual") {
    return "manual";
  }
  if (source === "gog" || source === "ggdeals") {
    return "store-api";
  }
  if (source === "steam-store") {
    return "store-api-experimental";
  }
  if (source === "mock") {
    return "mock";
  }
  return "partner";
}

function compareOffers(a: StoreOffer, b: StoreOffer): number {
  return compareTrustedOffers(a, b);
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
    service: logServiceFromPrisma(log.service),
    level: log.level,
    message: log.message,
    createdAt: log.createdAt
  };
}

async function findPrismaMockPriceSourceIds(): Promise<string[]> {
  const sources = await prisma.priceSource.findMany({
    where: {
      OR: [{ type: "mock" }, { name: { contains: "mock", mode: "insensitive" } }]
    },
    select: { id: true }
  });
  return sources.map((source) => source.id);
}

function mockOfferWhere(mockSourceIds: string[]): Prisma.StoreOfferWhereInput {
  return {
    OR: [
      { source: "mock" },
      { provider: "mock" },
      ...(mockSourceIds.length > 0 ? [{ sourceId: { in: mockSourceIds } }] : [])
    ]
  };
}

function mockSnapshotWhere(mockSourceIds: string[]): Prisma.GamePriceSnapshotWhereInput {
  return {
    OR: [
      { source: "mock" },
      { provider: "mock" },
      ...(mockSourceIds.length > 0 ? [{ sourceId: { in: mockSourceIds } }] : [])
    ]
  };
}

async function buildPrismaMockCleanupPreview(): Promise<MockPriceCleanupPreview> {
  const mockSourceIds = await findPrismaMockPriceSourceIds();
  const offerWhere = mockOfferWhere(mockSourceIds);
  const snapshotWhere = mockSnapshotWhere(mockSourceIds);
  const [mockOffers, mockSnapshots, mockSources] = await Promise.all([
    prisma.storeOffer.findMany({
      where: offerWhere,
      include: { game: { select: { id: true, steamAppId: true, title: true } } },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.gamePriceSnapshot.findMany({
      where: snapshotWhere,
      include: { game: { select: { id: true, steamAppId: true, title: true } } },
      orderBy: { capturedAt: "desc" }
    }),
    prisma.priceSource.findMany({
      where: { id: { in: mockSourceIds } },
      orderBy: { updatedAt: "desc" }
    })
  ]);
  const byGame = new Map<string, MockPriceCleanupPreview["affectedGames"][number]>();

  for (const offer of mockOffers) {
    const current = byGame.get(offer.gameId) ?? {
      gameId: offer.gameId,
      steamAppId: offer.game.steamAppId,
      title: offer.game.title,
      mockOfferCount: 0,
      mockPriceSnapshotCount: 0
    };
    current.mockOfferCount += 1;
    byGame.set(offer.gameId, current);
  }

  for (const snapshot of mockSnapshots) {
    const current = byGame.get(snapshot.gameId) ?? {
      gameId: snapshot.gameId,
      steamAppId: snapshot.game.steamAppId,
      title: snapshot.game.title,
      mockOfferCount: 0,
      mockPriceSnapshotCount: 0
    };
    current.mockPriceSnapshotCount += 1;
    byGame.set(snapshot.gameId, current);
  }

  const affectedGames = [...byGame.values()].sort(
    (a, b) => b.mockOfferCount + b.mockPriceSnapshotCount - (a.mockOfferCount + a.mockPriceSnapshotCount)
  );

  return {
    mockStoreOfferCount: mockOffers.length,
    mockPriceSnapshotCount: mockSnapshots.length,
    mockPriceSourceCount: mockSources.length,
    affectedGameCount: affectedGames.length,
    affectedGames,
    examples: [
      ...mockOffers.slice(0, 3).map((offer) => ({
        kind: "offer" as const,
        id: offer.id,
        gameId: offer.gameId,
        steamAppId: offer.steamAppId,
        title: offer.title,
        storeName: offer.storeName,
        sourceName: sourceName(sourceFromPrisma(offer.source))
      })),
      ...mockSnapshots.slice(0, 3).map((snapshot) => ({
        kind: "price-snapshot" as const,
        id: snapshot.id,
        gameId: snapshot.gameId,
        steamAppId: snapshot.steamAppId,
        title: snapshot.game.title,
        storeName: snapshot.storeName,
        sourceName: sourceName(sourceFromPrisma(snapshot.source))
      })),
      ...mockSources.slice(0, 3).map((source) => ({
        kind: "price-source" as const,
        id: source.id,
        gameId: null,
        steamAppId: null,
        title: null,
        storeName: null,
        sourceName: source.name
      }))
    ].slice(0, 8)
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

  async countOffersBySource(source: PriceDataSource): Promise<number> {
    return prisma.storeOffer.count({ where: { source: sourceToPrisma(source) } });
  }

  private async summaryForGame(game: Game): Promise<GameSummary | null> {
    const snapshotRepository = new PrismaSnapshotRepository();
    const [priceHistory, playerHistory, offers] = await Promise.all([
      snapshotRepository.listPrices(game.id),
      snapshotRepository.listPlayers(game.id),
      this.listOffers(game.id)
    ]);
    const trustedPriceHistory = priceHistory.filter((snapshot) => isTrustedPriceSource(snapshot.source));
    const trustedOffers = trustedOffersOnly(offers);
    const latestPrice = await latestByGame(trustedPriceHistory);
    const latestPlayers = await latestByGame(playerHistory);
    const bestOffer = trustedOffers[0] ?? null;

    return {
      game,
      latestPrice,
      latestPlayers,
      bestOffer,
      score: calculateGameValueScore({
        latestPrice,
        priceHistory: trustedPriceHistory,
        latestPlayers,
        playerHistory,
        offers: trustedOffers,
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

class PrismaGogRepository implements GogRepository {
  async searchCatalog(query: string, limit = 10): Promise<GogCatalogEntry[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const entries = await prisma.gogCatalogEntry.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: trimmed, mode: "insensitive" } },
          { slug: { contains: trimmed.toLowerCase(), mode: "insensitive" } },
          { gogProductId: trimmed }
        ]
      },
      orderBy: [{ title: "asc" }],
      take: limit
    });
    return entries.map(mapGogCatalogEntry);
  }

  async upsertCatalogEntries(entries: Array<Omit<GogCatalogEntry, "createdAt" | "updatedAt">>) {
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = await prisma.gogCatalogEntry.findUnique({ where: { gogProductId: entry.gogProductId } });
      await prisma.gogCatalogEntry.upsert({
        where: { gogProductId: entry.gogProductId },
        update: {
          title: entry.title,
          slug: entry.slug,
          url: entry.url,
          imageUrl: entry.imageUrl,
          isActive: entry.isActive,
          productType: entry.productType,
          rawData: entry.rawData as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
          syncedAt: entry.syncedAt
        },
        create: {
          id: entry.id,
          gogProductId: entry.gogProductId,
          title: entry.title,
          slug: entry.slug,
          url: entry.url,
          imageUrl: entry.imageUrl,
          isActive: entry.isActive,
          productType: entry.productType,
          rawData: entry.rawData as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
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

  async listMappings(limit = 100): Promise<GameExternalMapping[]> {
    const mappings = await prisma.gameExternalMapping.findMany({
      where: { provider: "gog" },
      orderBy: { updatedAt: "desc" },
      take: limit
    });
    return mappings.map(mapGameExternalMapping);
  }

  async findMappingByGameId(gameId: string): Promise<GameExternalMapping | null> {
    const mapping = await prisma.gameExternalMapping.findUnique({
      where: { gameId_provider: { gameId, provider: "gog" } }
    });
    return mapping ? mapGameExternalMapping(mapping) : null;
  }

  async findMappingsByGameIds(gameIds: string[]): Promise<GameExternalMapping[]> {
    if (gameIds.length === 0) {
      return [];
    }
    const mappings = await prisma.gameExternalMapping.findMany({
      where: { provider: "gog", gameId: { in: gameIds } }
    });
    return mappings.map(mapGameExternalMapping);
  }

  async upsertMapping(input: {
    gameId: string;
    externalId: string;
    externalSlug?: string | null;
    confidence: GameExternalMapping["confidence"];
  }): Promise<GameExternalMapping> {
    const now = new Date();
    const mapping = await prisma.gameExternalMapping.upsert({
      where: { gameId_provider: { gameId: input.gameId, provider: "gog" } },
      update: {
        externalId: input.externalId,
        externalSlug: input.externalSlug ?? null,
        confidence: input.confidence,
        updatedAt: now
      },
      create: {
        id: `mapping-gog-${input.gameId}-${input.externalId}`,
        gameId: input.gameId,
        provider: "gog",
        externalId: input.externalId,
        externalSlug: input.externalSlug ?? null,
        confidence: input.confidence,
        createdAt: now,
        updatedAt: now
      }
    });
    return mapGameExternalMapping(mapping);
  }

  async status() {
    const [gogCatalogEntries, gogMappings, latest, lastSearchLog] = await Promise.all([
      prisma.gogCatalogEntry.count(),
      prisma.gameExternalMapping.count({ where: { provider: "gog" } }),
      prisma.gogCatalogEntry.findFirst({ orderBy: { syncedAt: "desc" } }),
      prisma.integrationLog.findFirst({
        where: { service: "gog", message: { startsWith: "GOG catalog search" } },
        orderBy: { createdAt: "desc" }
      })
    ]);
    return {
      gogCatalogEntries,
      gogMappings,
      lastGogSync: latest?.syncedAt ?? null,
      lastGogCatalogSearch: lastSearchLog?.createdAt ?? null
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

  async countPriceSnapshotsBySource(source: PriceDataSource): Promise<number> {
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
      manualPriceSnapshots,
      gogPriceSnapshots,
      steamStorePriceSnapshots,
      mockPriceSnapshots,
      manualOffers,
      gogOffers,
      steamStoreOffers,
      mockOffers
    ] = await Promise.all([
      prisma.storeOffer.count(),
      prisma.gamePriceSnapshot.count(),
      prisma.store.count(),
      prisma.priceSource.count(),
      new PrismaSnapshotRepository().latestPriceRefresh(),
      new PrismaSnapshotRepository().countPriceSnapshotsBySource("manual"),
      new PrismaSnapshotRepository().countPriceSnapshotsBySource("gog"),
      new PrismaSnapshotRepository().countPriceSnapshotsBySource("steam-store"),
      new PrismaSnapshotRepository().countPriceSnapshotsBySource("mock"),
      new PrismaGameRepository().countOffersBySource("manual"),
      new PrismaGameRepository().countOffersBySource("gog"),
      new PrismaGameRepository().countOffersBySource("steam-store"),
      new PrismaGameRepository().countOffersBySource("mock")
    ]);
    const realInternalPriceSnapshots = manualPriceSnapshots + gogPriceSnapshots + steamStorePriceSnapshots;
    const realOffers = manualOffers + gogOffers + steamStoreOffers;
    return {
      offerCount,
      priceSnapshotCount,
      storeCount,
      priceSourceCount,
      lastPriceSnapshot: latestPriceSnapshot,
      realInternalPriceSnapshots,
      mockPriceSnapshots,
      realOffers,
      mockOffers,
      steamStoreOfferCount: steamStoreOffers,
      steamStorePriceSnapshotCount: steamStorePriceSnapshots
    };
  }

  async previewMockCleanup(): Promise<MockPriceCleanupPreview> {
    return buildPrismaMockCleanupPreview();
  }

  async runMockCleanup(): Promise<MockPriceCleanupRun> {
    const preview = await buildPrismaMockCleanupPreview();
    const mockSourceIds = await findPrismaMockPriceSourceIds();
    const offerWhere = mockOfferWhere(mockSourceIds);
    const snapshotWhere = mockSnapshotWhere(mockSourceIds);

    const [deletedOffers, deletedSnapshots, deletedSources] = await prisma.$transaction([
      prisma.storeOffer.deleteMany({ where: offerWhere }),
      prisma.gamePriceSnapshot.deleteMany({ where: snapshotWhere }),
      prisma.priceSource.deleteMany({ where: { id: { in: mockSourceIds } } })
    ]);

    return {
      ...preview,
      deletedStoreOffers: deletedOffers.count,
      deletedPriceSnapshots: deletedSnapshots.count,
      deletedPriceSources: deletedSources.count
    };
  }
}

class PrismaDiagnosticsRepository implements DiagnosticsRepository {
  async recordIntegrationLog(log: Omit<IntegrationLog, "id" | "createdAt">): Promise<IntegrationLog> {
    const entry = await prisma.integrationLog.create({
      data: {
        id: `log-${Date.now()}`,
        service: logServiceToPrisma(log.service) as PrismaIntegrationService,
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
    const manualPriceSnapshots = await new PrismaSnapshotRepository().countPriceSnapshotsBySource("manual");
    const gogPriceSnapshots = await new PrismaSnapshotRepository().countPriceSnapshotsBySource("gog");
    const steamStorePriceSnapshots = await new PrismaSnapshotRepository().countPriceSnapshotsBySource("steam-store");
    const realInternalPriceSnapshots = manualPriceSnapshots + gogPriceSnapshots + steamStorePriceSnapshots;
    const realPriceSnapshots =
      realInternalPriceSnapshots +
      (await new PrismaSnapshotRepository().countPriceSnapshotsBySource("ggdeals")) +
      (await new PrismaSnapshotRepository().countPriceSnapshotsBySource("price-api"));
    const realOffers =
      (await new PrismaGameRepository().countOffersBySource("manual")) +
      (await new PrismaGameRepository().countOffersBySource("gog")) +
      (await new PrismaGameRepository().countOffersBySource("steam-store")) +
      (await new PrismaGameRepository().countOffersBySource("ggdeals")) +
      (await new PrismaGameRepository().countOffersBySource("price-api"));
    const [gogStatus, gogOfferCount, steamStoreOfferCount, lastGogPriceRefresh, lastSteamStorePriceRefresh] = await Promise.all([
      new PrismaGogRepository().status(),
      new PrismaGameRepository().countOffersBySource("gog"),
      new PrismaGameRepository().countOffersBySource("steam-store"),
      prisma.gamePriceSnapshot.findFirst({ where: { source: "gog" }, orderBy: { capturedAt: "desc" } }),
      prisma.gamePriceSnapshot.findFirst({ where: { source: "steam_store" }, orderBy: { capturedAt: "desc" } })
    ]);
    const gogLogs = integrationLogs.filter((log) => log.service === "gog");
    const steamStoreLogs = integrationLogs.filter((log) => log.service === "steam-store");
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
      gogEnabled: isGogEnabled(),
      gogCatalogEntries: gogStatus.gogCatalogEntries,
      gogMappings: gogStatus.gogMappings,
      gogMappedGames: gogStatus.gogMappings,
      gogOfferCount,
      gogPriceSnapshotCount: gogPriceSnapshots,
      lastGogSync: gogStatus.lastGogSync,
      lastGogCatalogSearch: gogStatus.lastGogCatalogSearch,
      lastGogError: gogLogs.find((log) => log.level === "error") ?? null,
      lastGogPriceRefresh: lastGogPriceRefresh?.capturedAt ?? null,
      gogCountryCode: getGogCountryCode(),
      gogCurrency: getGogCurrency(),
      gogStatusMessage: isGogEnabled() ? null : "GOG connector disabled by environment.",
      steamStorePriceEnabled: isSteamStorePriceEnabled(),
      steamStoreCountryCode: getSteamStoreCountryCode(),
      steamStoreCurrency: getSteamStoreCurrency(),
      steamStoreMaxPerRun: getSteamStorePriceMaxPerRun(),
      steamStoreCacheTtlMinutes: getSteamStorePriceCacheTtlMinutes(),
      steamStoreOfferCount,
      steamStorePriceSnapshotCount: steamStorePriceSnapshots,
      lastSteamStorePriceRefresh: lastSteamStorePriceRefresh?.capturedAt ?? null,
      lastSteamStorePriceError: steamStoreLogs.find((log) => log.level === "error") ?? null,
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
    gog: new PrismaGogRepository(),
    prices: new PrismaPriceRepository(),
    watchlist: new PrismaWatchlistRepository(),
    alerts: new PrismaAlertRepository(),
    snapshots: new PrismaSnapshotRepository(),
    diagnostics: new PrismaDiagnosticsRepository()
  };
}
