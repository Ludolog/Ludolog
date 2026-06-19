import { describe, expect, it } from "vitest";

import { repositories } from "@/lib/repositories";
import { gameSearchService } from "@/lib/services/game-search-service";
import { statsService } from "@/lib/services/stats-service";

describe("StatsService", () => {
  it("calculates top players from player snapshots", async () => {
    const overview = await statsService.overview(5);

    expect(overview.topPlayers.length).toBeGreaterThan(0);
    expect(overview.topPlayers[0].currentPlayers).toBeGreaterThanOrEqual(overview.topPlayers.at(-1)?.currentPlayers ?? 0);
  });

  it("calculates percentage trends", async () => {
    const overview = await statsService.overview(8);

    expect(overview.trending.some((game) => game.playerTrendPercent !== 0)).toBe(true);
  });

  it("builds best-value and category rankings", async () => {
    const overview = await statsService.overview(8);

    expect(overview.bestValue.length).toBeGreaterThan(0);
    expect(overview.categories.find((category) => category.id === "strategy")?.games.length).toBeGreaterThan(0);
    expect(overview.categories.find((category) => category.id === "multiplayer-coop")?.games.length).toBeGreaterThan(0);
  });

  it("includes an imported Steam catalog game after a player snapshot is stored", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-7654322",
        steamAppId: 7654322,
        title: "Stats Fixture Arena",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);
    const imported = await gameSearchService.importGame({ steamAppId: 7654322 });
    await repositories.snapshots.appendPlayers({
      id: "players-stats-fixture-arena-steam-api",
      gameId: imported.summary.game.id,
      steamAppId: 7654322,
      playersOnline: 999999,
      capturedAt: new Date(Date.now() + 1000),
      source: "steam-api"
    });

    const overview = await statsService.overview(20);

    expect(overview.sourceCounts.importedGames).toBeGreaterThan(0);
    expect(overview.sourceCounts.realPlayerSnapshots).toBeGreaterThan(0);
    expect(overview.topPlayers.some((game) => game.steamAppId === 7654322)).toBe(true);
    expect(["real", "mixed"]).toContain(overview.mode);
  });
});
