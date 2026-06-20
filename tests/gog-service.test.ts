import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as searchGogCatalog } from "@/app/api/admin/gog/catalog/search/route";
import { POST as discoverGogCatalog } from "@/app/api/admin/gog/catalog/discover/route";
import { POST as approveGogMapping } from "@/app/api/admin/gog/mappings/approve/route";
import { POST as createGogMapping } from "@/app/api/admin/gog/mappings/route";
import { POST as suggestGogMappings } from "@/app/api/admin/gog/mappings/suggest/route";
import { POST as backfillGogCatalogPrices } from "@/app/api/admin/gog/prices/backfill-catalog/route";
import { POST as refreshGogPrices } from "@/app/api/admin/gog/prices/refresh/route";
import { GET as getGogAdminStatus } from "@/app/api/admin/gog/status/route";
import { repositories } from "@/lib/repositories";
import {
  GogCatalogConnector,
  GogConnectorError,
  GogPriceConnector,
  GogProductMapper,
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

const sampleWitcherProduct = {
  id: "1207658924",
  title: "The Witcher 3: Wild Hunt",
  slug: "the_witcher_3_wild_hunt",
  productType: "game",
  storeLink: "https://www.gog.com/en/game/the_witcher_3_wild_hunt",
  price: {
    finalMoney: { amount: "29.99", currency: "PLN" },
    baseMoney: { amount: "149.99", currency: "PLN" },
    discount: "-80%"
  }
};

const sampleStardewProduct = {
  id: "1453375253",
  title: "Stardew Valley",
  slug: "stardew_valley",
  productType: "game",
  storeLink: "https://www.gog.com/en/game/stardew_valley",
  price: {
    finalMoney: { amount: "14.99", currency: "USD" },
    baseMoney: { amount: "14.99", currency: "USD" }
  }
};

const sampleSoundtrackProduct = {
  id: "soundtrack-1",
  title: "Hollow Knight Soundtrack",
  slug: "hollow_knight_soundtrack",
  productType: "game",
  storeLink: "https://www.gog.com/en/game/hollow_knight_soundtrack",
  price: {
    finalMoney: { amount: "4.99", currency: "USD" },
    baseMoney: { amount: "9.99", currency: "USD" },
    discount: "-50%"
  }
};

const sampleNoPriceProduct = {
  id: "no-price-1",
  title: "No Price Game",
  slug: "no_price_game",
  productType: "game",
  storeLink: "https://www.gog.com/en/game/no_price_game"
};

const sampleWitcherCompleteProduct = {
  id: "complete-1",
  title: "The Witcher 3: Wild Hunt - Complete Edition",
  slug: "the_witcher_3_wild_hunt_complete_edition",
  productType: "game",
  storeLink: "https://www.gog.com/en/game/the_witcher_3_wild_hunt_complete_edition"
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
      configuredCurrency: "PLN",
      returnedCurrency: "USD",
      currencyMismatch: true,
      currencyMessage: "GOG returned USD while PLN is configured. Stored without FX conversion.",
      productType: "unknown",
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

  it("keeps GOG visible in admin status even when public GOG data is hidden", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubEnv("SHOW_GOG_PUBLIC", "false");

    const response = await getGogAdminStatus();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.gogEnabled).toBe(true);
    expect(body).toHaveProperty("gogCatalogEntries");
    expect(body).toHaveProperty("gogMappings");
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
    expect(Array.isArray(body.suggestedMappings)).toBe(true);
    expect(Array.isArray(body.uncertainMatches)).toBe(true);
  });

  it("rejects weak GOG fuzzy matches instead of marking them uncertain", () => {
    const mapper = new GogProductMapper();
    const [suggestion] = mapper.suggest(
      {
        id: "dota-2",
        steamAppId: 570,
        title: "Dota 2",
        slug: "dota-2",
        platform: "PC",
        description: "",
        coverUrl: "",
        genres: [],
        developer: "",
        publisher: "",
        releaseDate: "2013-07-09",
        reviewScore: 90,
        source: "steam-api",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      [
        {
          id: "gog-catalog-dotage",
          gogProductId: "dotage",
          title: "dotAGE",
          slug: "dotage",
          url: "https://www.gog.com/game/dotage",
          imageUrl: null,
          isActive: true,
          productType: "game",
          rawData: null,
          syncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    );

    expect(suggestion).toMatchObject({
      confidence: "unknown",
      rejected: true,
      reason: expect.stringContaining("Rejected weak fuzzy match")
    });
  });

  it("rejects random GOG candidates for Dead Rising 2", () => {
    const mapper = new GogProductMapper();
    const [suggestion] = mapper.suggest(
      {
        id: "dead-rising-2",
        steamAppId: 45740,
        title: "Dead Rising 2",
        slug: "dead-rising-2",
        platform: "PC",
        description: "",
        coverUrl: "",
        genres: [],
        developer: "",
        publisher: "",
        releaseDate: "2010-09-28",
        reviewScore: 75,
        source: "steam-api",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      [
        {
          id: "gog-catalog-random",
          gogProductId: "random",
          title: "Dead Age 2",
          slug: "dead_age_2",
          url: "https://www.gog.com/game/dead_age_2",
          imageUrl: null,
          isActive: true,
          productType: "game",
          rawData: null,
          syncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    );

    expect(suggestion).toMatchObject({
      confidence: "unknown",
      rejected: true,
      reason: expect.stringContaining("Rejected weak fuzzy match")
    });
  });

  it("keeps Witcher 3 Complete Edition for manual review instead of exact mapping", () => {
    const mapper = new GogProductMapper();
    const [suggestion] = mapper.suggest(
      {
        id: "the-witcher-3",
        steamAppId: 292030,
        title: "The Witcher 3: Wild Hunt",
        slug: "the-witcher-3",
        platform: "PC",
        description: "",
        coverUrl: "",
        genres: [],
        developer: "",
        publisher: "",
        releaseDate: "2015-05-18",
        reviewScore: 95,
        source: "steam-api",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      [
        {
          id: "gog-catalog-complete-1",
          gogProductId: "complete-1",
          title: sampleWitcherCompleteProduct.title,
          slug: sampleWitcherCompleteProduct.slug,
          url: sampleWitcherCompleteProduct.storeLink,
          imageUrl: null,
          isActive: true,
          productType: "game",
          rawData: sampleWitcherCompleteProduct,
          syncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    );

    expect(suggestion).toMatchObject({
      confidence: "title-match",
      reason: expect.stringContaining("Manual review")
    });
  });

  it("suggests GOG mappings for manual review without writing mappings", async () => {
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

    const response = await suggestGogMappings(
      new Request("http://localhost/api/admin/gog/mappings/suggest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ mode: "imported-games", limit: 2 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mode: "imported-games" });
    expect(Array.isArray(body.exactMatches)).toBe(true);
    expect(Array.isArray(body.reviewRequired)).toBe(true);
    expect(Array.isArray(body.uncertain)).toBe(true);
    expect(Array.isArray(body.rejectedBadCandidates)).toBe(true);
    expect(Array.isArray(body.skipped)).toBe(true);
  });

  it("dry-runs GOG catalog price backfill into CatalogStoreOffer without writing", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ products: [sampleWitcherProduct] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-1207658924",
        gogProductId: "1207658924",
        title: "The Witcher 3: Wild Hunt",
        slug: "the_witcher_3_wild_hunt",
        url: "https://www.gog.com/en/game/the_witcher_3_wild_hunt",
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: sampleWitcherProduct,
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);
    const beforeStatus = await repositories.catalogOffers.status(new Date());

    const response = await backfillGogCatalogPrices(
      new Request("http://localhost/api/admin/gog/prices/backfill-catalog", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ gogProductIds: ["1207658924"], limit: 1, dryRun: true })
      })
    );
    const body = await response.json();
    const afterStatus = await repositories.catalogOffers.status(new Date());

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ sourceName: "gog", dryRun: true, requested: 1, refreshed: 0, skipped: 1, failed: 0 });
    expect(body.results[0].preview).toMatchObject({ gogProductId: "1207658924", storeName: "GOG" });
    expect(afterStatus.catalogStoreOfferCount).toBe(beforeStatus.catalogStoreOfferCount);
  });

  it("fetches catalog GOG prices from stored entry rawData without re-searching", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-1453375253",
        gogProductId: "1453375253",
        title: "Stardew Valley",
        slug: "stardew_valley",
        url: "https://www.gog.com/en/game/stardew_valley",
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: sampleStardewProduct,
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);

    const response = await gogService.backfillCatalogPrices({ gogProductIds: ["1453375253"], limit: 1, dryRun: true });

    expect(response).toMatchObject({ requested: 1, refreshed: 0, skipped: 1, failed: 0 });
    expect(response.results[0].preview).toMatchObject({
      gogProductId: "1453375253",
      returnedCurrency: "USD",
      configuredCurrency: "PLN",
      currencyMismatch: true,
      productType: "baseGame"
    });
    expect(response.warnings[0]).toMatchObject({ status: "currency-mismatch" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("counts catalog no-price products as skipped instead of failed", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | RequestInfo) => {
        const requestUrl = String(url);
        if (requestUrl.includes("/products/")) {
          return new Response(JSON.stringify({ id: sampleNoPriceProduct.id, title: sampleNoPriceProduct.title, slug: sampleNoPriceProduct.slug }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ products: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-no-price-1",
        gogProductId: "no-price-1",
        title: sampleNoPriceProduct.title,
        slug: sampleNoPriceProduct.slug,
        url: sampleNoPriceProduct.storeLink,
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: sampleNoPriceProduct,
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);

    const response = await gogService.backfillCatalogPrices({ gogProductIds: ["no-price-1"], limit: 1, dryRun: true });

    expect(response).toMatchObject({ requested: 1, refreshed: 0, skipped: 1, skippedNoPrice: 1, failed: 0 });
    expect(response.errors).toHaveLength(0);
    expect(response.warnings[0]).toMatchObject({ status: "no-price", productType: "baseGame" });
    expect(response.results[0]).toMatchObject({ skipped: true, status: "no-price" });
  });

  it("reports explicit GOG product IDs missing from the local catalog as unavailable", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const response = await gogService.backfillCatalogPrices({ gogProductIds: ["missing-gog-entry"], limit: 1, dryRun: true });

    expect(response).toMatchObject({ requested: 1, refreshed: 0, skipped: 1, skippedNoPrice: 1, failed: 0 });
    expect(response.errors).toHaveLength(0);
    expect(response.warnings[0]).toMatchObject({ gogProductId: "missing-gog-entry", status: "unavailable" });
    expect(response.results[0]).toMatchObject({ gogProductId: "missing-gog-entry", skipped: true, status: "unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("treats technical GOG catalog lookup errors as failed", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("<!DOCTYPE html><html></html>", {
          status: 503,
          headers: { "content-type": "text/html" }
        });
      })
    );
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-technical-error-1",
        gogProductId: "technical-error-1",
        title: "Technical Error Game",
        slug: "technical_error_game",
        url: "https://www.gog.com/en/game/technical_error_game",
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: null,
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);

    const response = await gogService.backfillCatalogPrices({ gogProductIds: ["technical-error-1"], limit: 1, dryRun: true });

    expect(response).toMatchObject({ requested: 1, refreshed: 0, skipped: 0, failed: 1 });
    expect(response.errors[0]).toMatchObject({ gogProductId: "technical-error-1" });
    expect(response.results[0]).toMatchObject({ skipped: false, status: "error" });
  });

  it("skips soundtrack and DLC-like GOG catalog products by default", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-soundtrack-1",
        gogProductId: "soundtrack-1",
        title: sampleSoundtrackProduct.title,
        slug: sampleSoundtrackProduct.slug,
        url: sampleSoundtrackProduct.storeLink,
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: sampleSoundtrackProduct,
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);

    const response = await gogService.backfillCatalogPrices({ gogProductIds: ["soundtrack-1"], limit: 1, dryRun: true });

    expect(response).toMatchObject({ requested: 1, refreshed: 0, skipped: 1, skippedUnsupported: 1, failed: 0 });
    expect(response.warnings[0]).toMatchObject({ status: "unsupported", productType: "soundtrack" });
    expect(response.results[0]).toMatchObject({ status: "unsupported", productType: "soundtrack" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("writes base-game GOG catalog prices into CatalogStoreOffer", async () => {
    vi.stubEnv("GOG_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn());
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-write-base-1",
        gogProductId: "write-base-1",
        title: "Write Base Game",
        slug: "write_base_game",
        url: "https://www.gog.com/en/game/write_base_game",
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: {
          ...sampleWitcherProduct,
          id: "write-base-1",
          title: "Write Base Game",
          slug: "write_base_game",
          storeLink: "https://www.gog.com/en/game/write_base_game"
        },
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);
    const beforeStatus = await repositories.catalogOffers.status(new Date(), "gog");

    const response = await gogService.backfillCatalogPrices({ gogProductIds: ["write-base-1"], limit: 1, dryRun: false });
    const afterStatus = await repositories.catalogOffers.status(new Date(), "gog");

    expect(response).toMatchObject({ requested: 1, refreshed: 1, skipped: 0, failed: 0, createdOffers: 1 });
    expect(response.results[0]).toMatchObject({ refreshed: true, status: "refreshed", productType: "baseGame" });
    expect(afterStatus.providerCatalogStoreOfferCount).toBe((beforeStatus.providerCatalogStoreOfferCount ?? 0) + 1);
  });

  it("approves a GOG mapping and fills the slug from a stored catalog entry", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    await repositories.gog.upsertCatalogEntries([
      {
        id: "gog-catalog-1207658924",
        gogProductId: "1207658924",
        title: "The Witcher 3: Wild Hunt",
        slug: "the_witcher_3_wild_hunt",
        url: "https://www.gog.com/en/game/the_witcher_3_wild_hunt",
        imageUrl: null,
        isActive: true,
        productType: "game",
        rawData: sampleWitcherProduct,
        syncedAt: new Date("2026-06-20T00:00:00.000Z")
      }
    ]);

    const response = await approveGogMapping(
      new Request("http://localhost/api/admin/gog/mappings/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({
          gameId: "the-witcher-3",
          gogProductId: "1207658924",
          confidence: "manual"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      gameId: "the-witcher-3",
      provider: "gog",
      externalId: "1207658924",
      externalSlug: "the_witcher_3_wild_hunt",
      confidence: "manual"
    });
  });

  it("approves GOG mappings idempotently without duplicate rows", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    const requestBody = {
      gameId: "cyberpunk-2077",
      gogProductId: "2093619782",
      externalSlug: "cyberpunk_2077",
      confidence: "manual"
    };

    await approveGogMapping(
      new Request("http://localhost/api/admin/gog/mappings/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify(requestBody)
      })
    );
    const response = await approveGogMapping(
      new Request("http://localhost/api/admin/gog/mappings/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify(requestBody)
      })
    );
    const mappings = await repositories.gog.listMappings(50);

    expect(response.status).toBe(201);
    expect(mappings.filter((mapping) => mapping.gameId === "cyberpunk-2077" && mapping.provider === "gog")).toHaveLength(1);
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
