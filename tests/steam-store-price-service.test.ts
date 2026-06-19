import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as refreshSteamStorePrices } from "@/app/api/admin/steam-store-prices/refresh/route";
import { POST as testSteamStorePrice } from "@/app/api/admin/steam-store-prices/test/route";
import { repositories } from "@/lib/repositories";
import {
  SteamStoreConnectorError,
  SteamStorePriceConnector,
  SteamStorePriceNormalizer
} from "@/lib/services/steam-store-price-service";

const sampleDotaAppDetails = {
  "570": {
    success: true,
    data: {
      name: "Dota 2",
      type: "game",
      is_free: true
    }
  }
};

const samplePaidAppDetails = {
  "292030": {
    success: true,
    data: {
      name: "The Witcher 3: Wild Hunt",
      type: "game",
      is_free: false,
      price_overview: {
        currency: "PLN",
        initial: 11999,
        final: 2999,
        discount_percent: 75
      }
    }
  }
};

describe("Steam Store price connector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes Steam Store minor-unit price overview JSON", () => {
    const normalizer = new SteamStorePriceNormalizer();

    const normalized = normalizer.normalize(292030, samplePaidAppDetails, "PL", "PLN");

    expect(normalized).toMatchObject({
      steamAppId: 292030,
      title: "The Witcher 3: Wild Hunt",
      storeName: "Steam",
      sourceName: "steam-store",
      sourceType: "store-api-experimental",
      price: 29.99,
      regularPrice: 119.99,
      currency: "PLN",
      discountPercent: 75,
      drm: "Steam",
      isFreeToPlay: false
    });
  });

  it("treats free-to-play appdetails without price_overview as a zero-price preview", () => {
    const normalizer = new SteamStorePriceNormalizer();

    const normalized = normalizer.normalize(570, sampleDotaAppDetails, "PL", "PLN");

    expect(normalized).toMatchObject({
      steamAppId: 570,
      title: "Dota 2",
      price: 0,
      regularPrice: 0,
      currency: "PLN",
      isFreeToPlay: true
    });
  });

  it("rejects non-JSON Steam Store responses without exposing raw HTML", async () => {
    const connector = new SteamStorePriceConnector({
      cacheTtlMinutes: 0,
      fetcher: vi.fn(async () => {
        return new Response("<!DOCTYPE html><html><title>Just a moment</title></html>", {
          status: 403,
          headers: { "content-type": "text/html; charset=UTF-8" }
        });
      })
    });

    await expect(connector.getAppDetails(570)).rejects.toMatchObject({
      errorType: "invalid_response"
    } satisfies Partial<SteamStoreConnectorError>);
    await expect(connector.getAppDetails(570)).rejects.not.toThrow(/<html|Just a moment/i);
  });

  it("requires ADMIN_API_SECRET for Steam Store price tests", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("STEAM_STORE_PRICE_ENABLED", "true");

    const response = await testSteamStorePrice(
      new Request("http://localhost/api/admin/steam-store-prices/test", {
        method: "POST",
        body: JSON.stringify({ steamAppId: 570 })
      })
    );

    expect(response.status).toBe(401);
  });

  it("performs a Steam Store dry run without writing offers or snapshots", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("STEAM_STORE_PRICE_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify(sampleDotaAppDetails), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    const beforeOffers = (await repositories.games.listOffers("dota-2")).filter((offer) => offer.source === "steam-store");
    const beforeSnapshots = (await repositories.snapshots.listPrices("dota-2")).filter(
      (snapshot) => snapshot.source === "steam-store"
    );

    const response = await refreshSteamStorePrices(
      new Request("http://localhost/api/admin/steam-store-prices/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ steamAppIds: [570], limit: 1, dryRun: true })
      })
    );
    const body = await response.json();
    const afterOffers = (await repositories.games.listOffers("dota-2")).filter((offer) => offer.source === "steam-store");
    const afterSnapshots = (await repositories.snapshots.listPrices("dota-2")).filter(
      (snapshot) => snapshot.source === "steam-store"
    );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ sourceName: "steam-store", dryRun: true, requested: 1, refreshed: 0, skipped: 1 });
    expect(afterOffers).toHaveLength(beforeOffers.length);
    expect(afterSnapshots).toHaveLength(beforeSnapshots.length);
  });
});
