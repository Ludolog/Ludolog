import { describe, expect, it } from "vitest";

import { getPlayerHistory } from "@/lib/store";
import { playerCountRefreshService } from "@/lib/services/player-count-refresh-service";
import { steamApiService } from "@/lib/services/steam-api-service";

describe("Steam player-count refresh", () => {
  it("stores a snapshot through backend refresh flow", async () => {
    const before = getPlayerHistory("cyberpunk-2077").length;
    const snapshot = await steamApiService.refreshPlayerCount(1091500);
    const after = getPlayerHistory("cyberpunk-2077").length;

    expect(snapshot?.steamAppId).toBe(1091500);
    expect(after).toBeGreaterThan(before);
  });

  it("refreshes an explicit Steam App ID list without failing the whole batch", async () => {
    const before = getPlayerHistory("counter-strike-2").length;
    const result = await playerCountRefreshService.refresh("top", 20, [730, 999999999]);
    const after = getPlayerHistory("counter-strike-2").length;

    expect(result.mode).toBe("explicit");
    expect(result.requested).toBe(2);
    expect(result.refreshed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(after).toBeGreaterThan(before);
  });
});
