import { isDevMockFallbackEnabled } from "@/lib/config";
import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import { compareTrustedOffers, isTrustedPriceSource, trustedOffersOnly } from "@/lib/services/price-source-utils";
import type { GamePriceSnapshot, GameProfile, GameSummary, PlayerCountSnapshot } from "@/lib/types";

export function publicPlayerSnapshot(snapshot: PlayerCountSnapshot | null): PlayerCountSnapshot | null {
  if (!snapshot) {
    return null;
  }
  if (snapshot.source === "mock" && !isDevMockFallbackEnabled()) {
    return null;
  }
  return snapshot;
}

export function publicPlayerHistory(history: PlayerCountSnapshot[]): PlayerCountSnapshot[] {
  if (isDevMockFallbackEnabled()) {
    return history;
  }
  return history.filter((snapshot) => snapshot.source !== "mock");
}

export function publicGameSummary(summary: GameSummary): GameSummary {
  const latestPrice = isTrustedPriceSource(summary.latestPrice?.source) ? summary.latestPrice : null;
  const bestOffer =
    summary.bestOffer && summary.bestOffer.available && isTrustedPriceSource(summary.bestOffer.source)
      ? summary.bestOffer
      : null;
  const latestPlayers = publicPlayerSnapshot(summary.latestPlayers);

  return {
    ...summary,
    latestPrice,
    latestPlayers,
    bestOffer,
    score: calculateGameValueScore({
      latestPrice,
      priceHistory: latestPrice ? [latestPrice] : [],
      latestPlayers,
      playerHistory: latestPlayers ? [latestPlayers] : [],
      offers: bestOffer ? [bestOffer] : [],
      reviewScore: summary.game.reviewScore
    })
  };
}

export function publicGameProfile(profile: GameProfile): GameProfile {
  const priceHistory = profile.priceHistory.filter((snapshot) => isTrustedPriceSource(snapshot.source));
  const playerHistory = publicPlayerHistory(profile.playerHistory);
  const offers = trustedOffersOnly(profile.offers).sort(compareTrustedOffers);
  const latestPrice = latestByDate(priceHistory);
  const latestPlayers = publicPlayerSnapshot(profile.latestPlayers) ?? latestByDate(playerHistory);
  const bestOffer = offers[0] ?? null;
  const historicalLow = priceHistory.length > 0 ? Math.min(...priceHistory.map((snapshot) => snapshot.historicalLow)) : null;
  const priceDeltaPercent =
    latestPrice && historicalLow !== null && historicalLow > 0
      ? Math.round(((latestPrice.price - historicalLow) / historicalLow) * 1000) / 10
      : latestPrice?.price === 0
        ? 0
        : null;

  return {
    ...profile,
    latestPrice,
    latestPlayers,
    bestOffer,
    priceHistory,
    playerHistory,
    offers,
    historicalLow,
    priceDeltaPercent,
    score: calculateGameValueScore({
      latestPrice,
      priceHistory,
      latestPlayers,
      playerHistory,
      offers,
      reviewScore: profile.game.reviewScore
    })
  };
}

function latestByDate<T extends GamePriceSnapshot | PlayerCountSnapshot>(items: T[]): T | null {
  return [...items].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0] ?? null;
}
