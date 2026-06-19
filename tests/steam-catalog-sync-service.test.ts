import { afterEach, describe, expect, it, vi } from "vitest";

import { repositories } from "@/lib/repositories";
import { SteamCatalogSyncService } from "@/lib/services/steam-catalog-sync-service";

describe("SteamCatalogSyncService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("maps Steam app list responses to catalog entries", () => {
    const service = new SteamCatalogSyncService();
    const entries = service.mapSteamApps([
      {
        appid: 730,
        name: "Counter-Strike 2",
        app_type: "game",
        last_modified: 123,
        price_change_number: 456
      },
      {
        appid: 0,
        name: ""
      }
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "steam-catalog-730",
      steamAppId: 730,
      title: "Counter-Strike 2",
      appType: "game",
      isGame: true,
      source: "steam-api"
    });
  });

  it("passes startAfterAppId as the Steam pagination cursor", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "test-steam-key");
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            apps: [
              {
                appid: 124,
                name: "Cursor Fixture",
                app_type: "game"
              }
            ],
            have_more_results: false,
            last_appid: 124
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new SteamCatalogSyncService();
    const result = await service.sync({ dryRun: true, maxPages: 1, maxResults: 100, startAfterAppId: 123 });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(requestUrl.searchParams.get("last_appid")).toBe("123");
    expect(result.fetched).toBe(1);
    expect(result.lastAppId).toBe(124);
    expect(result.hasMore).toBe(false);
    expect(result.source).toBe("steam-api");
  });

  it("uses the stored next catalog cursor when startAfterAppId is omitted", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "test-steam-key");
    await repositories.steamCatalog.upsertMany([
      {
        id: "steam-catalog-7654999",
        steamAppId: 7654999,
        title: "Stored Cursor Fixture",
        appType: "game",
        lastModified: null,
        priceChangeNumber: null,
        isGame: true,
        isActive: true,
        source: "steam-api",
        syncedAt: new Date("2026-06-19T00:00:00.000Z")
      }
    ]);
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            apps: [
              {
                appid: 7655000,
                name: "Next Cursor Fixture",
                app_type: "game"
              }
            ],
            have_more_results: true,
            last_appid: 7655000
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new SteamCatalogSyncService();
    const result = await service.sync({ dryRun: true, maxPages: 1, maxResults: 100 });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(requestUrl.searchParams.get("last_appid")).toBe("7654999");
    expect(result.hasMore).toBe(true);
    expect(result.lastAppId).toBe(7655000);
  });
});
