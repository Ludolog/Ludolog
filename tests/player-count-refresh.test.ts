import { describe, expect, it } from "vitest";

import { getPlayerHistory } from "@/lib/store";
import { steamApiService } from "@/lib/services/steam-api-service";

describe("Steam player-count refresh", () => {
  it("stores a snapshot through backend refresh flow", async () => {
    const before = getPlayerHistory("cyberpunk-2077").length;
    const snapshot = await steamApiService.refreshPlayerCount(1091500);
    const after = getPlayerHistory("cyberpunk-2077").length;

    expect(snapshot?.steamAppId).toBe(1091500);
    expect(after).toBeGreaterThan(before);
  });
});
