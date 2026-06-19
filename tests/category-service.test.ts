import { describe, expect, it } from "vitest";

import { GET as getCategoryDetails } from "@/app/api/categories/[slug]/route";
import { GET as getCategoriesOverview } from "@/app/api/categories/overview/route";
import { categoryRankingService, GameTagNormalizer } from "@/lib/services/category-service";
import type { Game } from "@/lib/types";

describe("CategoryRankingService", () => {
  it("classifies games using manual fallback and normalized tags", () => {
    const dota = gameFixture({ steamAppId: 570, genres: ["Steam"] });
    const strategy = gameFixture({ steamAppId: 999999, genres: ["Grand Strategy", "Simulation"] });

    expect(GameTagNormalizer.categoriesForGame(dota)).toEqual(expect.arrayContaining(["strategy", "multiplayer"]));
    expect(GameTagNormalizer.categoriesForGame(strategy)).toEqual(expect.arrayContaining(["strategy", "simulation"]));
  });

  it("returns category overview DTOs with top games", async () => {
    const overview = await categoryRankingService.overview(4);
    const popular = overview.categories.find((category) => category.slug === "popularne-teraz");

    expect(popular).toBeDefined();
    expect(popular?.type).toBe("trend");
    expect(popular?.topGames.length).toBeGreaterThan(0);
    expect(popular?.updatedAt).toEqual(expect.any(String));
  });

  it("serves category overview and details routes", async () => {
    const overviewResponse = await getCategoriesOverview(new Request("http://localhost/api/categories/overview"));
    const detailsResponse = await getCategoryDetails(new Request("http://localhost/api/categories/strategy"), {
      params: Promise.resolve({ slug: "strategy" })
    });
    const overview = await overviewResponse.json();
    const details = await detailsResponse.json();

    expect(overviewResponse.status).toBe(200);
    expect(overview.categories.some((category: { slug: string }) => category.slug === "strategy")).toBe(true);
    expect(detailsResponse.status).toBe(200);
    expect(details.slug).toBe("strategy");
    expect(Array.isArray(details.games)).toBe(true);
  });
});

function gameFixture(input: Pick<Game, "steamAppId" | "genres">): Game {
  return {
    id: `game-${input.steamAppId}`,
    steamAppId: input.steamAppId,
    title: `Game ${input.steamAppId}`,
    slug: `game-${input.steamAppId}`,
    platform: "Steam",
    description: "Fixture",
    coverUrl: "https://example.com/header.jpg",
    genres: input.genres,
    developer: "Fixture",
    publisher: "Fixture",
    releaseDate: "2026-01-01",
    reviewScore: 80,
    source: "steam-api",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
