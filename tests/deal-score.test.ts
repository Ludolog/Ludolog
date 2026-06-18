import { describe, expect, it } from "vitest";

import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import { getGameProfile } from "@/lib/store";

describe("GameValue Score", () => {
  it("returns a bounded score with an explainable recommendation", () => {
    const profile = getGameProfile("stardew-valley");

    expect(profile).not.toBeNull();
    const result = calculateGameValueScore({
      latestPrice: profile?.latestPrice ?? null,
      priceHistory: profile?.priceHistory ?? [],
      latestPlayers: profile?.latestPlayers ?? null,
      playerHistory: profile?.playerHistory ?? [],
      offers: profile?.offers ?? [],
      reviewScore: profile?.game.reviewScore
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["buy_now", "wait", "weak_deal"]).toContain(result.recommendation);
    expect(result.factors.pricePosition).toBeGreaterThanOrEqual(0);
  });

  it("rewards games close to historical low", () => {
    const result = calculateGameValueScore({
      latestPrice: {
        id: "test-price",
        gameId: "test-game",
        price: 10,
        historicalLow: 10,
        basePrice: 50,
        discountPercent: 80,
        storeName: "Mock",
        currency: "PLN",
        capturedAt: new Date(),
        source: "mock"
      },
      priceHistory: [],
      latestPlayers: {
        id: "test-players",
        gameId: "test-game",
        steamAppId: 1,
        playersOnline: 25000,
        capturedAt: new Date(),
        source: "mock"
      },
      playerHistory: [],
      offers: [
        {
          id: "offer",
          gameId: "test-game",
          storeName: "Mock",
          price: 10,
          currency: "PLN",
          discountPercent: 80,
          url: "https://example.com",
          isOfficial: true,
          drm: "Steam",
          updatedAt: new Date(),
          source: "mock"
        }
      ]
    });

    expect(result.score).toBeGreaterThan(70);
    expect(result.recommendation).toBe("buy_now");
  });
});
