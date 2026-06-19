import { describe, expect, it } from "vitest";

import { SteamCatalogSyncService } from "@/lib/services/steam-catalog-sync-service";

describe("SteamCatalogSyncService", () => {
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
});
