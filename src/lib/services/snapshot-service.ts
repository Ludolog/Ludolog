import { repositories } from "@/lib/repositories";
import type { GameProfile, GamePriceSnapshot, PlayerCountSnapshot } from "@/lib/types";

function nextPrice(profile: GameProfile): number {
  const latest = profile.latestPrice?.price ?? 0;
  if (latest === 0) {
    return 0;
  }

  const scoreBias = profile.score.score >= 75 ? -0.015 : 0.012;
  const oscillation = Math.sin(Date.now() / 1000000) * 0.01;
  return Math.max(0, Number((latest * (1 + scoreBias + oscillation)).toFixed(2)));
}

function nextPlayers(profile: GameProfile): number {
  const latest = profile.latestPlayers?.playersOnline ?? 0;
  const trend = profile.score.factors.trend >= 50 ? 1.018 : 0.986;
  return Math.max(0, Math.round(latest * trend));
}

export class SnapshotService {
  async refreshGame(gameId: string): Promise<GameProfile | null> {
    const game = await repositories.games.findById(gameId);
    const profile = await repositories.games.getProfile(gameId);

    if (!game || !profile) {
      return null;
    }

    const now = new Date();
    const price = nextPrice(profile);
    const basePrice = profile.latestPrice?.basePrice ?? price;
    const historicalLow =
      profile.historicalLow === null ? price : Math.min(profile.historicalLow, price);
    const discountPercent = basePrice <= 0 ? 0 : Math.max(0, Math.round((1 - price / basePrice) * 100));

    const priceSnapshot: GamePriceSnapshot = {
      id: `price-${game.id}-${now.getTime()}`,
      gameId: game.id,
      price,
      historicalLow,
      basePrice,
      discountPercent,
      storeName: profile.bestOffer?.storeName ?? "Mock Store",
      currency: "PLN",
      capturedAt: now,
      source: "mock"
    };

    const playerSnapshot: PlayerCountSnapshot = {
      id: `players-${game.id}-${now.getTime()}`,
      gameId: game.id,
      steamAppId: game.steamAppId,
      playersOnline: nextPlayers(profile),
      capturedAt: now,
      source: "mock"
    };

    await repositories.snapshots.appendPrice(priceSnapshot);
    await repositories.snapshots.appendPlayers(playerSnapshot);

    await repositories.diagnostics.recordIntegrationLog({
      service: "snapshot",
      level: "info",
      message: `Refreshed mock snapshots for ${game.title}.`
    });

    return repositories.games.getProfile(gameId);
  }
}

export const snapshotService = new SnapshotService();
