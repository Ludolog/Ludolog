import { describe, expect, it } from "vitest";

import { steamApiService } from "@/lib/services/steam-api-service";

describe("SteamApiService", () => {
  it("falls back to mock player counts in mock mode", async () => {
    const snapshot = await steamApiService.getCurrentPlayers(1091500);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.playersOnline).toBeGreaterThan(0);
    expect(snapshot?.source).toBe("mock");
  });
});
