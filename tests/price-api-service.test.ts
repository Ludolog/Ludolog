import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as refreshPrices } from "@/app/api/admin/prices/refresh/route";
import { repositories } from "@/lib/repositories";
import { priceApiService } from "@/lib/services/price-api-service";
import { normalizeGGDealsOffers, priceProviderService } from "@/lib/services/price-provider-service";

describe("PriceApiService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns mock offers for a configured game", async () => {
    const offers = await priceApiService.listOffers("cyberpunk-2077");

    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]?.price).toBeGreaterThan(0);
    expect(offers.some((offer) => offer.storeName === "GOG.com")).toBe(true);
  });

  it("maps a defensive GG.deals-like response to normalized offers", () => {
    const offers = normalizeGGDealsOffers(
      {
        data: {
          deals: [
            {
              deal_id: "deal-1",
              shop: { name: "Steam" },
              current_price: "39.99",
              regular_price: "199.99",
              discount_percent: 80,
              currency: "PLN",
              url: "https://gg.deals/deal-1",
              isOfficialStore: true,
              historical_low: 35
            }
          ]
        }
      },
      570,
      new Date("2026-06-19T00:00:00.000Z")
    );

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      provider: "ggdeals",
      steamAppId: 570,
      storeName: "Steam",
      storeType: "official",
      price: 39.99,
      regularPrice: 199.99,
      discountPercent: 80,
      currency: "PLN",
      historicalLow: 35,
      sourceRawId: "deal-1"
    });
  });

  it("falls back to mock provider when GG.deals is selected without a key", async () => {
    vi.stubEnv("DATA_MODE", "api");
    vi.stubEnv("PRICE_MODE", "api");
    vi.stubEnv("PRICE_PROVIDER", "ggdeals");
    vi.stubEnv("GGDEALS_API_KEY", "");

    const offers = await priceProviderService.getPricesBySteamAppId(1091500);

    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]?.provider).toBe("mock");
  });

  it("requires ADMIN_API_SECRET for admin price refresh", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await refreshPrices(
      new Request("http://localhost/api/admin/prices/refresh", {
        method: "POST",
        body: JSON.stringify({ steamAppIds: [1091500], limit: 1 })
      })
    );

    expect(response.status).toBe(401);
  });

  it("refreshes prices through the fallback provider and stores offers and snapshots", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    const beforeSnapshots = await repositories.snapshots.listPrices("cyberpunk-2077");

    const response = await refreshPrices(
      new Request("http://localhost/api/admin/prices/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ steamAppIds: [1091500], limit: 1 })
      })
    );
    const body = await response.json();
    const afterSnapshots = await repositories.snapshots.listPrices("cyberpunk-2077");
    const offers = await repositories.games.listOffers("cyberpunk-2077");

    expect(response.status).toBe(200);
    expect(body.refreshed).toBe(1);
    expect(offers.length).toBeGreaterThan(0);
    expect(afterSnapshots.length).toBeGreaterThan(beforeSnapshots.length);
  });

  it("/api/deals/best summaries use real offers when they exist", async () => {
    const now = new Date(Date.now() + 2000);
    await repositories.games.upsertOffers("cyberpunk-2077", [
      {
        id: "offer-cyberpunk-2077-ggdeals-test",
        gameId: "cyberpunk-2077",
        provider: "ggdeals",
        storeName: "Steam",
        storeType: "official",
        price: 1.99,
        regularPrice: 199.99,
        historicalLow: 1.99,
        currency: "PLN",
        discountPercent: 99,
        url: "https://gg.deals/game/cyberpunk-2077",
        externalUrl: "https://gg.deals/game/cyberpunk-2077",
        isOfficial: true,
        isHistoricalLow: true,
        drm: "Steam",
        sourceRawId: "deal-cyberpunk-test",
        rawProviderData: null,
        fetchedAt: now,
        updatedAt: now,
        source: "ggdeals"
      }
    ]);
    await repositories.snapshots.appendPrice({
      id: "price-cyberpunk-2077-ggdeals-test",
      gameId: "cyberpunk-2077",
      provider: "ggdeals",
      storeType: "official",
      price: 1.99,
      historicalLow: 1.99,
      basePrice: 199.99,
      discountPercent: 99,
      storeName: "Steam",
      currency: "PLN",
      externalUrl: "https://gg.deals/game/cyberpunk-2077",
      isHistoricalLow: true,
      sourceRawId: "deal-cyberpunk-test",
      rawProviderData: null,
      fetchedAt: now,
      capturedAt: now,
      source: "ggdeals"
    });

    const deals = await repositories.games.bestDeals(20);
    const cyberpunk = deals.find((summary) => summary.game.id === "cyberpunk-2077");

    expect(cyberpunk?.bestOffer?.source).toBe("ggdeals");
    expect(cyberpunk?.latestPrice?.source).toBe("ggdeals");
    expect(cyberpunk?.bestOffer?.price).toBe(1.99);
  });
});
