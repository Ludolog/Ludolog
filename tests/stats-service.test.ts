import { describe, expect, it } from "vitest";

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
});
