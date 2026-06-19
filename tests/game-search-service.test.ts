import { describe, expect, it } from "vitest";

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

  it("imports a fallback catalog game as a normal library game", async () => {
    const response = await gameSearchService.importGame({ steamAppId: 1623730 });

    expect(response.summary.game.title).toBe("Palworld");
    expect(response.summary.game.source).toBe("mock");

    const results = await gameSearchService.searchCatalog("palworld");
    expect(results[0]?.kind).toBe("library");
  });
});
