import { getDataMode, getSteamWebApiKey, isDevMockFallbackEnabled } from "@/lib/config";
import { repositories } from "@/lib/repositories";
import type { PlayerCountSnapshot } from "@/lib/types";

type SteamPlayersResponse = {
  response?: {
    player_count?: number;
    result?: number;
  };
};

export class SteamApiService {
  async getCurrentPlayers(steamAppId: number): Promise<PlayerCountSnapshot | null> {
    if (getDataMode() === "api" && getSteamWebApiKey()) {
      const live = await this.trySteamPlayerEndpoint(steamAppId);
      if (live) {
        return live;
      }
    } else if (getDataMode() === "api" && !getSteamWebApiKey()) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "steam",
        level: "warning",
        message: `STEAM_WEB_API_KEY is not configured. Player count for app ${steamAppId} used cached fallback.`
      });
    }

    const cached = await repositories.snapshots.latestPlayersBySteamAppId(steamAppId);
    if (cached?.source === "mock" && !isDevMockFallbackEnabled()) {
      return null;
    }
    return cached;
  }

  async refreshPlayerCount(steamAppId: number): Promise<PlayerCountSnapshot | null> {
    const game = (await repositories.games.list()).find((item) => item.steamAppId === steamAppId);
    if (!game) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "steam",
        level: "warning",
        message: `Steam player refresh skipped for unknown app ${steamAppId}.`
      });
      return null;
    }

    const current = await this.getCurrentPlayers(steamAppId);
    if (!current) {
      return null;
    }

    const snapshot: PlayerCountSnapshot = {
      ...current,
      id: `players-${game.id}-refresh-${Date.now()}`,
      gameId: game.id,
      capturedAt: new Date()
    };
    await repositories.snapshots.appendPlayers(snapshot);
    return snapshot;
  }

  async refreshManyPlayerCounts(steamAppIds: number[], limit = 25): Promise<PlayerCountSnapshot[]> {
    const results: PlayerCountSnapshot[] = [];

    for (const steamAppId of steamAppIds.slice(0, limit)) {
      const snapshot = await this.refreshPlayerCount(steamAppId);
      if (snapshot) {
        results.push(snapshot);
      }
    }

    return results;
  }

  private async trySteamPlayerEndpoint(steamAppId: number): Promise<PlayerCountSnapshot | null> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/");
        url.searchParams.set("appid", String(steamAppId));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        const response = await fetch(url, { next: { revalidate: 300 }, signal: controller.signal }).finally(() =>
          clearTimeout(timeout)
        );

        if (response.status === 404) {
          throw new Error("Steam API has no player-count data for this app.");
        }

        if (!response.ok) {
          throw new Error(`Steam API responded with ${response.status}`);
        }

        const payload = (await response.json()) as SteamPlayersResponse;
        const playersOnline = payload.response?.player_count;

        if (typeof playersOnline !== "number") {
          throw new Error("Steam API response did not include player_count.");
        }

        return {
          id: `steam-api-${steamAppId}-${Date.now()}`,
          gameId: `steam-app-${steamAppId}`,
          steamAppId,
          playersOnline,
          capturedAt: new Date(),
          source: "steam-api"
        };
      } catch (error) {
        if (attempt === 2) {
          await repositories.diagnostics.recordIntegrationLog({
            service: "steam",
            level: "warning",
            message: `Steam player endpoint failed for app ${steamAppId}: ${
              error instanceof Error ? error.message : "unknown error"
            }. Cached fallback was used when available.`
          });
          return null;
        }
      }
    }

    return null;
  }
}

export const steamApiService = new SteamApiService();
