import { getDataMode } from "@/lib/config";
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
    if (getDataMode() === "api") {
      const live = await this.trySteamPlayerEndpoint(steamAppId);
      if (live) {
        return live;
      }
    }

    return repositories.snapshots.latestPlayersBySteamAppId(steamAppId);
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

  async refreshManyPlayerCounts(steamAppIds: number[], limit = 10): Promise<PlayerCountSnapshot[]> {
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
    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${steamAppId}`;
      const response = await fetch(url, { next: { revalidate: 300 } });

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
      await repositories.diagnostics.recordIntegrationLog({
        service: "steam",
        level: "warning",
        message: `Steam player endpoint failed for app ${steamAppId}: ${
          error instanceof Error ? error.message : "unknown error"
        }. Mock fallback was used.`
      });
      return null;
    }
  }
}

export const steamApiService = new SteamApiService();
