import { Prisma, PrismaClient } from "@prisma/client";

import {
  mockGames,
  mockPlayerSnapshots,
  mockPriceAlerts,
  mockPriceSnapshots,
  mockStoreOffers,
  mockUsers,
  mockWatchlistItems
} from "../src/lib/mock-data";
import { calculateGameValueScore } from "../src/lib/services/deal-score-service";

const prisma = new PrismaClient();

function decimal(value: number): string {
  return value.toFixed(2);
}

async function main(): Promise<void> {
  await prisma.integrationLog.deleteMany();
  await prisma.dealScoreSnapshot.deleteMany();
  await prisma.priceAlert.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.playerCountSnapshot.deleteMany();
  await prisma.gamePriceSnapshot.deleteMany();
  await prisma.storeOffer.deleteMany();
  await prisma.priceSource.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();
  await prisma.game.deleteMany();

  await prisma.game.createMany({
    data: mockGames.map((game) => ({
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
      releaseDate: new Date(game.releaseDate),
      reviewScore: game.reviewScore,
      source: "mock",
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    }))
  });

  await prisma.user.createMany({
    data: mockUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    }))
  });

  await prisma.priceSource.create({
    data: {
      id: "price-source-mock-seed",
      name: "mock-seed",
      type: "mock",
      isActive: true,
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
      updatedAt: new Date("2026-06-18T12:00:00.000Z")
    }
  });

  const stores = [...new Map(mockStoreOffers.map((offer) => [offer.storeId, offer])).values()];
  await prisma.store.createMany({
    data: stores.map((offer) => ({
      id: offer.storeId as string,
      name: offer.storeName,
      slug: (offer.storeId as string).replace(/^store-/, ""),
      storeType: offer.storeType,
      websiteUrl: offer.storeName === "Steam" ? "https://store.steampowered.com/" : null,
      isActive: true,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt
    }))
  });

  await prisma.storeOffer.createMany({
    data: mockStoreOffers.map((offer) => ({
      id: offer.id,
      gameId: offer.gameId,
      steamAppId: offer.steamAppId,
      storeId: offer.storeId,
      sourceId: offer.sourceId,
      provider: offer.provider,
      storeName: offer.storeName,
      storeType: offer.storeType,
      title: offer.title,
      price: decimal(offer.price),
      regularPrice: offer.regularPrice === null ? null : decimal(offer.regularPrice),
      historicalLow: offer.historicalLow === null ? null : decimal(offer.historicalLow),
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
      source: "mock",
      updatedAt: offer.updatedAt
    }))
  });

  await prisma.gamePriceSnapshot.createMany({
    data: mockPriceSnapshots.map((snapshot) => ({
      id: snapshot.id,
      gameId: snapshot.gameId,
      steamAppId: snapshot.steamAppId,
      sourceId: snapshot.sourceId,
      provider: snapshot.provider,
      storeType: snapshot.storeType,
      price: decimal(snapshot.price),
      historicalLow: decimal(snapshot.historicalLow),
      basePrice: decimal(snapshot.basePrice),
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
      source: "mock"
    }))
  });

  await prisma.playerCountSnapshot.createMany({
    data: mockPlayerSnapshots.map((snapshot) => ({
      id: snapshot.id,
      gameId: snapshot.gameId,
      steamAppId: snapshot.steamAppId,
      playersOnline: snapshot.playersOnline,
      capturedAt: snapshot.capturedAt,
      source: "mock"
    }))
  });

  await prisma.watchlist.createMany({
    data: mockWatchlistItems.map((item) => ({
      id: item.id,
      userId: item.userId,
      gameId: item.gameId,
      targetPrice: item.targetPrice === null ? null : decimal(item.targetPrice),
      alertEnabled: item.alertEnabled,
      createdAt: item.createdAt
    }))
  });

  await prisma.priceAlert.createMany({
    data: mockPriceAlerts.map((alert) => ({
      id: alert.id,
      userId: alert.userId,
      gameId: alert.gameId,
      thresholdPrice: decimal(alert.thresholdPrice),
      isActive: alert.isActive,
      triggeredAt: alert.triggeredAt,
      createdAt: alert.createdAt
    }))
  });

  for (const game of mockGames) {
    const priceHistory = mockPriceSnapshots.filter((snapshot) => snapshot.gameId === game.id);
    const playerHistory = mockPlayerSnapshots.filter((snapshot) => snapshot.gameId === game.id);
    const offers = mockStoreOffers.filter((offer) => offer.gameId === game.id);
    const latestPrice = priceHistory.at(-1) ?? null;
    const latestPlayers = playerHistory.at(-1) ?? null;
    const result = calculateGameValueScore({
      latestPrice,
      priceHistory,
      latestPlayers,
      playerHistory,
      offers,
      reviewScore: game.reviewScore
    });

    await prisma.dealScoreSnapshot.create({
      data: {
        id: `score-${game.id}-seed`,
        gameId: game.id,
        score: result.score,
        recommendation: result.recommendation,
        factors: result.factors,
        reason: result.reason,
        capturedAt: new Date("2026-06-18T12:00:00.000Z")
      }
    });
  }

  await prisma.integrationLog.create({
    data: {
      id: "seed-log",
      service: "snapshot",
      level: "info",
      message: "Seeded GameValue Radar demonstration data."
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
