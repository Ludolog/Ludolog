import { describe, expect, it } from "vitest";

import { repositories } from "@/lib/repositories";
import { gameSearchService } from "@/lib/services/game-search-service";

describe("GameSearchService", () => {
  it("finds games by partial name across local data and the catalog", async () => {
    const results = await gameSearchService.searchCatalog("zomb");

    expect(results.some((result) => result.game.title === "Project Zomboid")).toBe(true);
    expect(results.every((result) => result.currentPlayers >= 0)).toBe(true);
  });

  it("marks catalog results as importable when they are not local library summaries", async () => {
    const results = await gameSearchService.searchCatalog("palworld");
    const palworld = results.find((result) => result.game.slug === "palworld");

    expect(palworld).toBeDefined();
    expect(palworld?.kind).toMatch(/library|catalog/);
    expect(typeof palworld?.importable).toBe("boolean");
    expect(["database", "steam-catalog", "mock-catalog"]).toContain(palworld?.source);
  });

  it("returns an existing fallback fixture from the local library without duplicating it", async () => {
    const response = await gameSearchService.importGame({ steamAppId: 1623730 });

    expect(response.summary.game.title).toBe("Palworld");
    expect(response.summary.game.source).toBe("mock");
    expect(response).toMatchObject({
      created: false,
      gameId: "palworld",
      imported: false,
      source: "library",
      steamAppId: 1623730
    });

    const duplicate = await gameSearchService.importGame({ steamAppId: 1623730 });
    expect(duplicate.imported).toBe(false);
    expect(duplicate.created).toBe(false);
    expect(duplicate.source).toBe("library");
    expect(duplicate.summary.game.id).toBe(response.summary.game.id);

    const results = await gameSearchService.searchCatalog("palworld");
    expect(results[0]?.kind).toBe("library");
  });

  it("uses SteamCatalogEntry results when the synced catalog has data", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-987654",
        steamAppId: 987654,
        title: "Quantum Catalog Fixture",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);

    const results = await gameSearchService.searchCatalog("quantum catalog fixture");

    expect(results[0]?.kind).toBe("catalog");
    expect(results[0]?.source).toBe("steam-catalog");
    expect(results[0]?.game.title).toBe("Quantum Catalog Fixture");
  });

  it("keeps library results ahead of duplicate Steam catalog entries", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-1091500",
        steamAppId: 1091500,
        title: "Cyberpunk 2077 Catalog Duplicate",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);

    const results = await gameSearchService.searchCatalog("cyberpunk");

    expect(results[0]?.kind).toBe("library");
    expect(results[0]?.game.steamAppId).toBe(1091500);
    expect(results.filter((result) => result.game.steamAppId === 1091500)).toHaveLength(1);
  });

  it("imports a synced SteamCatalogEntry as a library game", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-7654321",
        steamAppId: 7654321,
        title: "Import Fixture Arena",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);

    const response = await gameSearchService.importGame({ steamAppId: 7654321 });

    expect(response.imported).toBe(true);
    expect(response.created).toBe(true);
    expect(response.source).toBe("steam-catalog");
    expect(response.steamAppId).toBe(7654321);
    expect(response.summary.game.title).toBe("Import Fixture Arena");
    expect(response.summary.game.source).toBe("steam-api");

    const results = await gameSearchService.searchCatalog("import fixture arena");
    expect(results[0]?.kind).toBe("library");
    expect(results[0]?.source).toBe("database");
  });

  it("imports by query from the synced Steam catalog", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-7654323",
        steamAppId: 7654323,
        title: "Query Import Fixture",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);

    const response = await gameSearchService.importGame({ query: "Query Import Fixture" });

    expect(response.created).toBe(true);
    expect(response.source).toBe("steam-catalog");
    expect(response.steamAppId).toBe(7654323);
    expect(response.summary.game.title).toBe("Query Import Fixture");
  });
});
