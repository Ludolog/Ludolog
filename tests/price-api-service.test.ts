import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as diagnosePriceProvider } from "@/app/api/admin/prices/provider-diagnostics/route";
import { POST as refreshPrices } from "@/app/api/admin/prices/refresh/route";
import { repositories } from "@/lib/repositories";
import { priceApiService } from "@/lib/services/price-api-service";
import { classifyGGDealsResponse } from "@/lib/services/ggdeals-diagnostics";
import {
  GGDealsProviderError,
  GGDealsPriceProvider,
  normalizeGGDealsOffers,
  priceProviderService
} from "@/lib/services/price-provider-service";

describe("PriceApiService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("requests GG.deals prices through the documented Steam App ID endpoint", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            deals: [
              {
                deal_id: "deal-1",
                shop: { name: "Steam" },
                price: { amount: "39.99", currency: "PLN" },
                regularPrice: { amount: "199.99" },
                discount: 80,
                url: "https://gg.deals/deal-1",
                official: true
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const provider = new GGDealsPriceProvider({
      apiKey: "test-key",
      baseUrl: "https://gg.deals/api/prices/by-steam-app-id/",
      fetcher
    });

    const offers = await provider.getPricesBySteamAppId(570);
    const requestUrl = new URL(String(fetcher.mock.calls[0]?.[0]));

    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe("https://gg.deals/api/prices/by-steam-app-id/");
    expect(requestUrl.searchParams.get("key")).toBe("test-key");
    expect(requestUrl.searchParams.get("ids")).toBe("570");
    expect(requestUrl.searchParams.get("region")).toBe("pl");
    expect(requestUrl.searchParams.get("currency")).toBe("PLN");
    expect(offers[0]).toMatchObject({
      provider: "ggdeals",
      steamAppId: 570,
      storeName: "Steam",
      storeType: "official",
      price: 39.99,
      regularPrice: 199.99,
      currency: "PLN"
    });
  });

  it("classifies GG.deals Cloudflare HTML without exposing raw HTML", () => {
    const classification = classifyGGDealsResponse({
      body: "<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>",
      contentType: "text/html; charset=UTF-8",
      ok: false,
      status: 403
    });

    expect(classification.providerStatus).toBe("blocked_by_cloudflare");
    expect(classification.errorType).toBe("blocked_by_cloudflare");
    expect(classification.safePreview).toBeNull();
    expect(classification.message).not.toContain("<html");
  });

  it("throws a sanitized provider error for Cloudflare challenges", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("<!DOCTYPE html><html><title>Just a moment...</title></html>", {
        status: 403,
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    });
    const provider = new GGDealsPriceProvider({
      apiKey: "test-key",
      baseUrl: "https://gg.deals/api/prices/by-steam-app-id/",
      fetcher
    });

    await expect(provider.getPricesBySteamAppId(570)).rejects.toMatchObject({
      errorType: "blocked_by_cloudflare",
      providerStatus: "blocked_by_cloudflare"
    } satisfies Partial<GGDealsProviderError>);
    await expect(provider.getPricesBySteamAppId(570)).rejects.not.toThrow(/<html|Just a moment/i);
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

  it("does not store price data when GG.deals is blocked by Cloudflare", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("DATA_MODE", "api");
    vi.stubEnv("PRICE_MODE", "api");
    vi.stubEnv("PRICE_PROVIDER", "ggdeals");
    vi.stubEnv("GGDEALS_API_KEY", "test-ggdeals-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("<!DOCTYPE html><html><title>Just a moment...</title></html>", {
          status: 403,
          headers: { "content-type": "text/html; charset=UTF-8" }
        });
      })
    );
    const beforeSnapshots = await repositories.snapshots.listPrices("cyberpunk-2077");

    const response = await refreshPrices(
      new Request("http://localhost/api/admin/prices/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ steamAppIds: [1091500], limit: 1, dryRun: false })
      })
    );
    const body = await response.json();
    const afterSnapshots = await repositories.snapshots.listPrices("cyberpunk-2077");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      provider: "ggdeals",
      providerStatus: "blocked_by_cloudflare",
      fallbackUsed: true,
      refreshed: 0,
      failed: 1
    });
    expect(JSON.stringify(body)).not.toContain("<html");
    expect(JSON.stringify(body)).not.toContain("Just a moment");
    expect(afterSnapshots.length).toBe(beforeSnapshots.length);
  });

  it("returns masked GG.deals provider diagnostics", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("DATA_MODE", "api");
    vi.stubEnv("PRICE_MODE", "api");
    vi.stubEnv("PRICE_PROVIDER", "ggdeals");
    vi.stubEnv("GGDEALS_API_KEY", "test-ggdeals-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("<!DOCTYPE html><html><title>Just a moment...</title></html>", {
          status: 403,
          headers: { "content-type": "text/html; charset=UTF-8" }
        });
      })
    );

    const response = await diagnosePriceProvider(
      new Request("http://localhost/api/admin/prices/provider-diagnostics", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ provider: "ggdeals", steamAppIds: [570], dryRun: true })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("blocked_by_cloudflare");
    expect(body.attempts[0]).toMatchObject({
      requestUrl: expect.stringContaining("key=redacted"),
      providerStatus: "blocked_by_cloudflare",
      safePreview: null
    });
    expect(JSON.stringify(body)).not.toContain("test-ggdeals-key");
    expect(JSON.stringify(body)).not.toContain("<html");
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
