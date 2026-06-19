import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/admin/games/bulk-import/route";
import { repositories } from "@/lib/repositories";

describe("POST /api/admin/games/bulk-import", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires x-admin-secret", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await POST(
      new Request("http://localhost/api/admin/games/bulk-import", {
        method: "POST",
        body: JSON.stringify({ steamAppIds: [7654330], limit: 1 })
      })
    );

    expect(response.status).toBe(401);
  });

  it("imports at most the requested limit and reports skipped failures", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-7654330",
        steamAppId: 7654330,
        title: "Bulk Fixture One",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      },
      {
        id: "steam-catalog-7654331",
        steamAppId: 7654331,
        title: "Bulk Fixture Two",
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
      new Request("http://localhost/api/admin/games/bulk-import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ steamAppIds: [7654330, 7654331, 999999999], refreshPlayers: false, limit: 2 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.results).toHaveLength(2);
  });
});
