import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/games/[id]/route";
import { repositories } from "@/lib/repositories";
import type { GamePriceSnapshot, StoreOffer } from "@/lib/types";

describe("GET /api/games/:id", () => {
  it("returns a game profile with score, history and offers", async () => {
    const now = new Date();
    const offer: StoreOffer = {
      id: "offer-cyberpunk-2077-profile-manual",
      gameId: "cyberpunk-2077",
      steamAppId: 1091500,
      storeId: "store-steam",
      sourceId: "price-source-manual-admin",
      provider: "gamevalue",
      storeName: "Steam",
      storeType: "official",
      title: "Cyberpunk 2077",
      price: 119.99,
      regularPrice: 199.99,
      historicalLow: 79.99,
      currency: "PLN",
      discountPercent: 40,
      url: "https://store.steampowered.com/app/1091500",
      externalUrl: "https://store.steampowered.com/app/1091500",
      region: "PL",
      isOfficial: true,
      isOfficialStore: true,
      isHistoricalLow: false,
      available: true,
      drm: "Steam",
      platform: "PC",
      sourceRawId: "manual-profile-cyberpunk",
      rawProviderData: null,
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
      source: "manual",
      sourceConfidence: "internal-real",
      sourceName: "manual-admin",
      sourceType: "manual"
    };
    const snapshot: GamePriceSnapshot = {
      id: `price-cyberpunk-2077-profile-manual-${now.getTime()}`,
      gameId: "cyberpunk-2077",
      steamAppId: 1091500,
      sourceId: "price-source-manual-admin",
      provider: "gamevalue",
      storeType: "official",
      price: 119.99,
      bestPrice: 119.99,
      historicalLow: 79.99,
      basePrice: 199.99,
      discountPercent: 40,
      storeName: "Steam",
      currency: "PLN",
      externalUrl: "https://store.steampowered.com/app/1091500",
      offerCount: 1,
      isHistoricalLow: false,
      sourceRawId: "manual-profile-cyberpunk",
      rawProviderData: null,
      fetchedAt: now,
      capturedAt: now,
      createdAt: now,
      source: "manual",
      sourceConfidence: "internal-real",
      sourceName: "manual-admin",
      sourceType: "manual"
    };

    await repositories.games.upsertOffers("cyberpunk-2077", [offer]);
    await repositories.snapshots.appendPrice(snapshot);

    const response = await GET(new Request("http://localhost/api/games/cyberpunk-2077"), {
      params: Promise.resolve({ id: "cyberpunk-2077" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.game.title).toBe("Cyberpunk 2077");
    expect(body.score.score).toBeGreaterThanOrEqual(0);
    expect(body.priceHistory.length).toBeGreaterThan(0);
    expect(body.offers.length).toBeGreaterThan(0);
  });

  it("returns 404 for missing games", async () => {
    const response = await GET(new Request("http://localhost/api/games/missing"), {
      params: Promise.resolve({ id: "missing" })
    });

    expect(response.status).toBe(404);
  });
});
