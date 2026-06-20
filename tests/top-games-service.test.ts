import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as adminTopGamesImport } from "@/app/api/admin/top-games/import/route";
import { GET as publicTopGames } from "@/app/api/top-games/route";
import { repositories } from "@/lib/repositories";
import { isTrustedPriceSource } from "@/lib/services/price-source-utils";
import { topGamesService } from "@/lib/services/top-games-service";
import { curatedTopTrackedGames } from "@/lib/top-games-seed";
import type { StoreOffer } from "@/lib/types";

describe("TOP 100 games", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the curated Steam list bounded and unique", () => {
    const entries = curatedTopTrackedGames();
    const ids = new Set(entries.map((entry) => entry.steamAppId));

    expect(entries).toHaveLength(100);
    expect(ids.size).toBe(100);
    expect(entries[0]).toMatchObject({ steamAppId: 730, priority: 1, source: "curated-top-100" });
    expect(entries.at(-1)).toMatchObject({ steamAppId: 413420, priority: 100 });
  });

  it("returns public TOP 100 coverage without trusting mock prices as real Steam prices", async () => {
    const response = await publicTopGames(new Request("http://localhost/api/top-games?limit=100&sort=players"));
    const body = await response.json();
    const counterStrike = body.items.find((item: { steamAppId: number }) => item.steamAppId === 730);
    const notImported = body.items.find((item: { gameId: string | null }) => item.gameId === null);

    expect(response.status).toBe(200);
    expect(body.total).toBe(100);
    expect(body.coverage.topTrackedCount).toBe(100);
    expect(counterStrike).toMatchObject({
      steamAppId: 730,
      sourceName: "none",
      bestSteamPrice: null,
      gameValueScore: null,
      recommendation: "insufficient-data"
    });
    expect(counterStrike.noDataReasons).toContain("missing-steam-price");
    expect(notImported?.recommendation).toBe("insufficient-data");
  });

  it("scores a TOP 100 game only after a trusted Steam/manual price exists", async () => {
    const now = new Date();
    const manualOffer: StoreOffer = {
      id: "offer-counter-strike-2-top-games-manual",
      gameId: "counter-strike-2",
      steamAppId: 730,
      storeId: "store-steam",
      sourceId: "price-source-manual-admin",
      provider: "gamevalue",
      storeName: "Steam",
      storeType: "official",
      title: "Counter-Strike 2",
      price: 0,
      regularPrice: 0,
      historicalLow: 0,
      currency: "PLN",
      discountPercent: 0,
      url: "https://store.steampowered.com/app/730",
      externalUrl: "https://store.steampowered.com/app/730",
      region: "PL",
      isOfficial: true,
      isOfficialStore: true,
      isHistoricalLow: true,
      available: true,
      drm: "Steam",
      platform: "Steam",
      sourceRawId: "manual-top-games-cs2",
      rawProviderData: null,
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
      source: "manual",
      sourceConfidence: "internal-real",
      sourceName: "manual-admin",
      sourceType: "manual"
    };

    await repositories.games.upsertOffers("counter-strike-2", [manualOffer]);
    const data = await topGamesService.list({ limit: 100, sort: "score" });
    const counterStrike = data.items.find((item) => item.steamAppId === 730);

    expect(counterStrike?.sourceName).toBe("manual");
    expect(counterStrike?.bestSteamPrice).toBe(0);
    expect(counterStrike?.gameValueScore).toEqual(expect.any(Number));
    expect(counterStrike?.recommendation).not.toBe("insufficient-data");
  });

  it("guards TOP 100 admin import with ADMIN_API_SECRET and defaults to dry run", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const unauthorized = await adminTopGamesImport(
      new Request("http://localhost/api/admin/top-games/import", {
        method: "POST",
        body: JSON.stringify({ limit: 2 })
      })
    );
    const authorized = await adminTopGamesImport(
      new Request("http://localhost/api/admin/top-games/import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ limit: 2 })
      })
    );
    const body = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(body).toMatchObject({ dryRun: true, requested: 2 });
  });

  it("keeps GOG hidden from public trusted price selection unless explicitly enabled", () => {
    vi.stubEnv("SHOW_GOG_PUBLIC", "");
    expect(isTrustedPriceSource("gog")).toBe(false);

    vi.stubEnv("SHOW_GOG_PUBLIC", "true");
    expect(isTrustedPriceSource("gog")).toBe(true);
  });
});
