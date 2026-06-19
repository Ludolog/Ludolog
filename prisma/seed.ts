import { PrismaClient } from "@prisma/client";

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

  await prisma.storeOffer.createMany({
    data: mockStoreOffers.map((offer) => ({
      id: offer.id,
      gameId: offer.gameId,
      storeName: offer.storeName,
      price: decimal(offer.price),
      currency: offer.currency,
      discountPercent: offer.discountPercent,
      url: offer.url,
      isOfficial: offer.isOfficial,
      drm: offer.drm,
      source: "mock",
      updatedAt: offer.updatedAt
    }))
  });

  await prisma.gamePriceSnapshot.createMany({
    data: mockPriceSnapshots.map((snapshot) => ({
      id: snapshot.id,
      gameId: snapshot.gameId,
      price: decimal(snapshot.price),
      historicalLow: decimal(snapshot.historicalLow),
      basePrice: decimal(snapshot.basePrice),
      discountPercent: snapshot.discountPercent,
      storeName: snapshot.storeName,
      currency: snapshot.currency,
      capturedAt: snapshot.capturedAt,
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
