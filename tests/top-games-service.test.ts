import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as adminTopGamesImport } from "@/app/api/admin/top-games/import/route";
import { POST as adminTopGamesRefreshPlayers } from "@/app/api/admin/top-games/refresh-players/route";
import { POST as adminTopGamesRefreshPrices } from "@/app/api/admin/top-games/refresh-prices/route";
import { GET as publicTopGames } from "@/app/api/top-games/route";
import { repositories } from "@/lib/repositories";
import { isTrustedPriceSource } from "@/lib/services/price-source-utils";
import { clearSteamStoreDetailsCacheForTests } from "@/lib/services/steam-store-price-service";
import { topGamesService } from "@/lib/services/top-games-service";
import { curatedTopTrackedGames } from "@/lib/top-games-seed";
import type { StoreOffer } from "@/lib/types";

describe("TOP 100 games", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearSteamStoreDetailsCacheForTests();
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
    vi.stubEnv("DATA_MODE", "api");
    vi.stubEnv("ENABLE_DEV_MOCK_FALLBACK", "false");

    const response = await publicTopGames(new Request("http://localhost/api/top-games?limit=100&sort=players"));
    const body = await response.json();
    const counterStrike = body.items.find((item: { steamAppId: number }) => item.steamAppId === 730);
    const notImported = body.items.find((item: { gameId: string | null }) => item.gameId === null);

    expect(response.status).toBe(200);
    expect(body.total).toBe(100);
    expect(body.coverage.topTrackedCount).toBe(100);
    expect(body.coverage.mockPublicDataCount).toBe(0);
    expect(body.items.every((item: { playerSource: string }) => item.playerSource !== "mock")).toBe(true);
    expect(counterStrike).toMatchObject({
      steamAppId: 730,
      currentPlayers: null,
      playerSource: "no-data",
      playerFreshness: "missing",
      sourceName: "none",
      bestSteamPrice: null,
      gameValueScore: null,
      recommendation: "insufficient-data"
    });
    expect(counterStrike.noDataReasons).toContain("missing-steam-price");
    expect(counterStrike.noDataReasons).toContain("missing-player-count");
    expect(counterStrike.scoreExplanation).toContain("Brak aktualnych danych o liczbie graczy.");
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

  it("imports TOP 100 games through catalog, Steam Store appdetails and curated fallback without duplicates", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-359550",
        steamAppId: 359550,
        title: "Rainbow Six Siege Catalog Fixture",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const appId = url.searchParams.get("appids");
        const details =
          appId === "377160"
            ? {
                success: true,
                data: {
                  name: "Fallout 4",
                  type: "game",
                  header_image: "https://cdn.akamai.steamstatic.com/steam/apps/377160/header.jpg",
                  short_description: "Bethesda RPG.",
                  developers: ["Bethesda Game Studios"],
                  publishers: ["Bethesda Softworks"],
                  genres: [{ description: "RPG" }],
                  release_date: { date: "Nov 10, 2015" }
                }
              }
            : { success: false };

        return new Response(JSON.stringify({ [String(appId)]: details }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const report = await topGamesService.importTopGames({ limit: 28, dryRun: false });
    const duplicateReport = await topGamesService.importTopGames({ limit: 28, dryRun: false });
    const games = await repositories.games.list();
    const tracked = await repositories.topTrackedGames.listActive(100);

    expect(report.createdFromSteamCatalog).toBeGreaterThanOrEqual(1);
    expect(report.createdFromSteamStore).toBeGreaterThanOrEqual(1);
    expect(report.createdFromCuratedFallback).toBeGreaterThanOrEqual(1);
    expect(report.missingMetadata).toBeGreaterThanOrEqual(1);
    expect(report.results.find((result) => result.steamAppId === 730)).toMatchObject({
      alreadyExisting: true,
      sourceUsed: "existing-game"
    });
    expect(report.results.find((result) => result.steamAppId === 359550)).toMatchObject({
      imported: true,
      sourceUsed: "steam-catalog",
      title: "Rainbow Six Siege Catalog Fixture"
    });
    expect(report.results.find((result) => result.steamAppId === 377160)).toMatchObject({
      imported: true,
      sourceUsed: "steam-store-appdetails",
      title: "Fallout 4"
    });
    expect(report.results.find((result) => result.steamAppId === 1222670)).toMatchObject({
      imported: true,
      sourceUsed: "curated-top-100",
      missingFromSteamCatalog: true
    });
    expect(games.filter((game) => game.steamAppId === 377160)).toHaveLength(1);
    expect(games.filter((game) => game.steamAppId === 1222670)).toHaveLength(1);
    expect(tracked.find((entry) => entry.steamAppId === 377160)?.gameId).toBe("fallout-4");
    expect(tracked.find((entry) => entry.steamAppId === 1222670)?.gameId).toBe("the-sims-4");
    expect(duplicateReport.results.find((result) => result.steamAppId === 377160)).toMatchObject({
      alreadyExisting: true,
      sourceUsed: "existing-game"
    });
    expect((await repositories.games.list()).filter((game) => game.steamAppId === 377160)).toHaveLength(1);
  });

  it("keeps TOP 100 bootstrap dry run read-only for fallback imports", async () => {
    vi.stubEnv("STEAM_STORE_PRICE_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const appId = url.searchParams.get("appids") ?? "0";
        return new Response(
          JSON.stringify({
            [appId]: {
              success: true,
              data: {
                name: `Steam app ${appId}`,
                type: "game",
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      })
    );

    expect(await repositories.games.findBySteamAppId(489830)).toBeNull();
    expect(await repositories.steamCatalog.findBySteamAppId(489830)).toBeNull();

    const report = await topGamesService.bootstrap({ limit: 31, dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.import.results.find((result) => result.steamAppId === 489830)).toMatchObject({
      imported: false,
      sourceUsed: "steam-store-appdetails"
    });
    expect(await repositories.games.findBySteamAppId(489830)).toBeNull();
    expect(await repositories.steamCatalog.findBySteamAppId(489830)).toBeNull();
  });

  it("runs TOP 100 bootstrap with fallback import, player refresh and Steam Store price refresh by steamAppId", async () => {
    vi.stubEnv("DATA_MODE", "api");
    vi.stubEnv("ENABLE_DEV_MOCK_FALLBACK", "false");
    vi.stubEnv("STEAM_WEB_API_KEY", "test-steam-key");
    vi.stubEnv("STEAM_STORE_PRICE_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.pathname.includes("GetNumberOfCurrentPlayers")) {
          if (url.searchParams.get("appid") !== "306130") {
            return new Response(JSON.stringify({}), {
              status: 404,
              headers: { "content-type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ response: { player_count: 45678, result: 1 } }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        const appId = url.searchParams.get("appids") ?? "0";
        if (appId !== "306130") {
          return new Response(JSON.stringify({ [appId]: { success: false } }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(
          JSON.stringify({
            [appId]: {
              success: true,
              data: {
                name: appId === "306130" ? "The Elder Scrolls Online" : `Steam app ${appId}`,
                type: "game",
                is_free: false,
                price_overview: {
                  currency: "PLN",
                  initial: 9999,
                  final: 4999,
                  discount_percent: 50
                },
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
                genres: [{ description: "RPG" }]
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      })
    );

    const report = await topGamesService.bootstrap({ limit: 33, dryRun: false });
    const game = await repositories.games.findBySteamAppId(306130);
    const latestPlayers = await repositories.snapshots.latestPlayersBySteamAppId(306130);
    const steamOffers = game ? (await repositories.games.listOffers(game.id)).filter((offer) => offer.source === "steam-store") : [];
    const steamPrices = game ? (await repositories.snapshots.listPrices(game.id)).filter((snapshot) => snapshot.source === "steam-store") : [];

    expect(report.dryRun).toBe(false);
    expect(report.import.results.find((result) => result.steamAppId === 306130)).toMatchObject({
      imported: true,
      sourceUsed: "steam-store-appdetails"
    });
    expect(report.players.results.find((result) => result.steamAppId === 306130)).toMatchObject({
      refreshed: true,
      playersOnline: 45678
    });
    expect(report.prices.results.find((result) => result.steamAppId === 306130)).toMatchObject({
      refreshed: true,
      preview: expect.objectContaining({ price: 49.99, currency: "PLN" })
    });
    expect(game).toMatchObject({ steamAppId: 306130, source: "steam-api" });
    expect(latestPlayers).toMatchObject({ steamAppId: 306130, playersOnline: 45678, source: "steam-api" });
    expect(steamOffers.at(-1)).toMatchObject({ steamAppId: 306130, source: "steam-store", price: 49.99 });
    expect(steamPrices.at(-1)).toMatchObject({ steamAppId: 306130, source: "steam-store", price: 49.99 });
  });

  it("refreshes TOP 100 players through Steam API and stores a real snapshot", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("DATA_MODE", "api");
    vi.stubEnv("ENABLE_DEV_MOCK_FALLBACK", "false");
    vi.stubEnv("STEAM_WEB_API_KEY", "test-steam-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ response: { player_count: 123456, result: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const response = await adminTopGamesRefreshPlayers(
      new Request("http://localhost/api/admin/top-games/refresh-players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ limit: 1, dryRun: false })
      })
    );
    const body = await response.json();
    const latest = await repositories.snapshots.latestPlayersBySteamAppId(730);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ dryRun: false, requested: 1, refreshed: 1, createdSnapshots: 1, failed: 0, noData: 0 });
    expect(latest).toMatchObject({ steamAppId: 730, playersOnline: 123456, source: "steam-api" });
  });

  it("refreshes TOP 100 Steam Store prices and stores a trusted offer", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("STEAM_STORE_PRICE_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            "730": {
              success: true,
              data: {
                name: "Counter-Strike 2",
                type: "game",
                is_free: true
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      })
    );

    const response = await adminTopGamesRefreshPrices(
      new Request("http://localhost/api/admin/top-games/refresh-prices", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ limit: 1, dryRun: false })
      })
    );
    const body = await response.json();
    const steamOffers = (await repositories.games.listOffers("counter-strike-2")).filter((offer) => offer.source === "steam-store");
    const steamSnapshots = (await repositories.snapshots.listPrices("counter-strike-2")).filter(
      (snapshot) => snapshot.source === "steam-store"
    );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ dryRun: false, requested: 1, refreshed: 1, failed: 0, createdSnapshots: 1 });
    expect(steamOffers.at(-1)).toMatchObject({ steamAppId: 730, price: 0, source: "steam-store", sourceConfidence: "experimental-store-api" });
    expect(steamSnapshots.at(-1)).toMatchObject({ steamAppId: 730, price: 0, source: "steam-store", sourceConfidence: "experimental-store-api" });
  });

  it("keeps GOG hidden from public trusted price selection unless explicitly enabled", () => {
    vi.stubEnv("SHOW_GOG_PUBLIC", "");
    expect(isTrustedPriceSource("gog")).toBe(false);

    vi.stubEnv("SHOW_GOG_PUBLIC", "true");
    expect(isTrustedPriceSource("gog")).toBe(true);
  });
});
