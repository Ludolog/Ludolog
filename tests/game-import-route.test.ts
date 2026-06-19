import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/games/import/route";
import { repositories } from "@/lib/repositories";

describe("POST /api/games/import", () => {
  it("imports a synced Steam catalog entry and returns the public import contract", async () => {
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-7654340",
        steamAppId: 7654340,
        title: "Route Import Fixture",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);

    const response = await POST(
      new Request("http://localhost/api/games/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ steamAppId: 7654340 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      created: true,
      imported: true,
      source: "steam-catalog",
      steamAppId: 7654340,
      gameId: "route-import-fixture"
    });
    expect(body.summary.game.title).toBe("Route Import Fixture");
  });

  it("returns 404 when a requested game is missing from real and fallback catalogs", async () => {
    const response = await POST(
      new Request("http://localhost/api/games/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ steamAppId: 999999998 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("not available");
  });
});
