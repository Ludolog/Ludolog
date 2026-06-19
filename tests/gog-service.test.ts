import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as searchGogCatalog } from "@/app/api/admin/gog/catalog/search/route";
import { POST as discoverGogCatalog } from "@/app/api/admin/gog/catalog/discover/route";
import { POST as createGogMapping } from "@/app/api/admin/gog/mappings/route";
import { POST as refreshGogPrices } from "@/app/api/admin/gog/prices/refresh/route";
import { repositories } from "@/lib/repositories";
import {
  GogCatalogConnector,
  GogConnectorError,
  GogPriceConnector,
  GogPriceNormalizer,
  gogService
} from "@/lib/services/gog-service";
import { priceApiService } from "@/lib/services/price-api-service";

const sampleCyberpunkProduct = {
  id: "2093619782",
  title: "Cyberpunk 2077",
  slug: "cyberpunk_2077",
  productType: "pack",
  storeLink: "https://www.gog.com/en/game/cyberpunk_2077",
  coverHorizontal: "https://images.gog-statics.com/cyberpunk.png",
  price: {
    final: "$1.49",
    base: "$49.99",
    discount: "-97%",
    finalMoney: { amount: "1.49", currency: "USD", discount: "48.50" },
    baseMoney: { amount: "49.99", currency: "USD" }
  }
};

describe("GOG connector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses GOG catalog search JSON without real network calls", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ products: [sampleCyberpunkProduct] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const connector = new GogCatalogConnector({ fetcher, countryCode: "PL", currency: "PLN" });

    const products = await connector.search("cyberpunk", 1);
    const requestUrl = new URL(String(fetcher.mock.calls[0]?.[0]));

    expect(requestUrl.origin).toBe("https://catalog.gog.com");
    expect(requestUrl.pathname).toBe("/v1/catalog");
    expect(requestUrl.searchParams.get("query")).toBe("cyberpunk");
    expect(products[0]).toMatchObject({ id: "2093619782", title: "Cyberpunk 2077", slug: "cyberpunk_2077" });
  });

  it("normalizes a GOG price response into an official DRM-free offer preview", () => {
    const normalizer = new GogPriceNormalizer();

    const normalized = normalizer.normalize(sampleCyberpunkProduct, "PL", "PLN");

    expect(normalized).toMatchObject({
      gogProductId: "2093619782",
      title: "Cyberpunk 2077",
      slug: "cyberpunk_2077",
      price: 1.49,
      regularPrice: 49.99,
      currency: "USD",
      countryCode: "PL",
      discountPercent: 97,
      externalUrl: "https://www.gog.com/en/game/cyberpunk_2077"
    });
  });

  it("rejects non-JSON GOG responses and does not expose raw HTML", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("<!DOCTYPE html><html><title>Just a moment...</title></html>", {
        status: 403,
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    });
    const connector = new GogCatalogConnector({ fetcher });

    await expect(connector.search("cyberpunk", 1)).rejects.toMatchObject({
      errorType: "invalid_response"
    } satisfies Partial<GogConnectorError>);
    await expect(connector.search("cyberpunk", 1)).rejects.not.toThrow(/<html|Just a moment/i);
  });

  it("requires ADMIN_API_SECRET for GOG mapping writes", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await createGogMapping(
      new Request("http://localhost/api/admin/gog/mappings", {
        method: "POST",
        body: JSON.stringify({
          gameId: "cyberpunk-2077",
          gogProductId: "2093619782",
          externalSlug: "cyberpunk_2077",
          confidence: "manual"
        })
      })
    );

    expect(response.status).toBe(401);
  });

  it("creates a manual GOG mapping through the admin route", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await createGogMapping(
      new Request("http://localhost/api/admin/gog/mappings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({
          gameId: "cyberpunk-2077",
          gogProductId: "2093619782",
          externalSlug: "cyberpunk_2077",
          confidence: "manual"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      gameId: "cyberpunk-2077",
      provider: "gog",
      externalId: "2093619782",
      externalSlug: "cyberpunk_2077",
      confidence: "manual"
    });
  });

  it("search endpoint stores returned GOG catalog entries", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ products: [sampleCyberpunkProduct] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const response = await searchGogCatalog(
      new Request("http://localhost/api/admin/gog/catalog/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ query: "cyberpunk", limit: 1 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({ gogProductId: "2093619782", slug: "cyberpunk_2077" });
    expect(body.upserted.created + body.upserted.updated).toBeGreaterThan(0);
  });

  it("discovers GOG catalog products without creating mappings", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ products: [sampleCyberpunkProduct] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const response = await discoverGogCatalog(
      new Request("http://localhost/api/admin/gog/catalog/discover", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ mode: "top-steam-catalog", limit: 1 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe("top-steam-catalog");
    expect(body.foundProducts).toBe(1);
    expect(body.createdCatalogEntries + body.updatedCatalogEntries).toBeGreaterThan(0);
    expect(body.suggestedMappings.length + body.uncertainMatches.length).toBeGreaterThan(0);
  });

  it("refreshes a mapped GOG game into StoreOffer and GamePriceSnapshot", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ products: [sampleCyberpunkProduct] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    await repositories.gog.upsertMapping({
      gameId: "cyberpunk-2077",
      externalId: "2093619782",
      externalSlug: "cyberpunk_2077",
      confidence: "manual"
    });
    const beforeHistory = await repositories.snapshots.listPrices("cyberpunk-2077");

    const response = await refreshGogPrices(
      new Request("http://localhost/api/admin/gog/prices/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ mode: "mapped-games", gameIds: ["cyberpunk-2077"], limit: 1, dryRun: false })
      })
    );
    const body = await response.json();
    const offers = await priceApiService.listOffers("cyberpunk-2077");
    const afterHistory = await repositories.snapshots.listPrices("cyberpunk-2077");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ provider: "gamevalue", sourceName: "gog", requested: 1, refreshed: 1, failed: 0 });
    expect(offers.some((offer) => offer.source === "gog" && offer.storeName === "GOG" && offer.drm === "DRM-free")).toBe(true);
    expect(afterHistory.length).toBeGreaterThan(beforeHistory.length);
    expect(afterHistory.at(-1)).toMatchObject({ source: "gog", storeName: "GOG", sourceConfidence: "internal-real" });
  });

  it("dry-runs a mapped GOG price refresh without writing StoreOffer or GamePriceSnapshot", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ products: [sampleCyberpunkProduct] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    await repositories.gog.upsertMapping({
      gameId: "cyberpunk-2077",
      externalId: "2093619782",
      externalSlug: "cyberpunk_2077",
      confidence: "manual"
    });
    const beforeOffers = await priceApiService.listOffers("cyberpunk-2077");
    const beforeHistory = await repositories.snapshots.listPrices("cyberpunk-2077");

    const response = await refreshGogPrices(
      new Request("http://localhost/api/admin/gog/prices/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ mode: "mapped-games", gameIds: ["cyberpunk-2077"], limit: 1, dryRun: true })
      })
    );
    const body = await response.json();
    const afterOffers = await priceApiService.listOffers("cyberpunk-2077");
    const afterHistory = await repositories.snapshots.listPrices("cyberpunk-2077");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ dryRun: true, requested: 1, refreshed: 0, skipped: 1, failed: 0 });
    expect(body.results[0].preview).toMatchObject({ gogProductId: "2093619782", storeName: "GOG" });
    expect(afterOffers).toHaveLength(beforeOffers.length);
    expect(afterHistory).toHaveLength(beforeHistory.length);
  });

  it("skips unknown-confidence mappings without calling GOG", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await repositories.gog.upsertMapping({
      gameId: "dota-2",
      externalId: "unknown-gog-id",
      externalSlug: "unknown",
      confidence: "unknown"
    });

    const response = await gogService.refreshPrices({ gameIds: ["dota-2"], limit: 1 });

    expect(response).toMatchObject({ requested: 1, refreshed: 0, skipped: 1, failed: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("can resolve a mapped GOG offer through game price reads", async () => {
    const offers = await priceApiService.listOffers("cyberpunk-2077");
    const gogOffer = offers.find((offer) => offer.source === "gog");

    expect(gogOffer).toMatchObject({
      storeName: "GOG",
      storeType: "official",
      sourceName: "gog",
      sourceType: "store-api",
      isOfficialStore: true
    });
  });
});
