import { repositories } from "@/lib/repositories";
import { steamApiService } from "@/lib/services/steam-api-service";
import type { PlayerCountSnapshot } from "@/lib/types";

export type PlayerCountRefreshMode = "watchlist" | "top" | "all-imported";
export type PlayerCountRefreshRuntimeMode = PlayerCountRefreshMode | "explicit";

export type PlayerCountRefreshError = {
  steamAppId: number;
  message: string;
};

export type PlayerCountRefreshResult = {
  mode: PlayerCountRefreshRuntimeMode;
  requested: number;
  refreshed: number;
  failed: number;
  errors: PlayerCountRefreshError[];
  snapshots: PlayerCountSnapshot[];
};

export class PlayerCountRefreshService {
  async refresh(
    mode: PlayerCountRefreshMode,
    limit = 25,
    explicitSteamAppIds?: number[]
  ): Promise<PlayerCountRefreshResult> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const refreshMode: PlayerCountRefreshRuntimeMode = explicitSteamAppIds && explicitSteamAppIds.length > 0 ? "explicit" : mode;
    const steamAppIds = explicitSteamAppIds && explicitSteamAppIds.length > 0
      ? unique(explicitSteamAppIds).slice(0, safeLimit)
      : await this.resolveSteamAppIds(mode, safeLimit);
    const { errors, snapshots } = await this.refreshSteamAppIds(steamAppIds, safeLimit);

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: errors.length > 0 ? "warning" : "info",
      message: `Player-count refresh finished. mode=${refreshMode}, requested=${steamAppIds.length}, refreshed=${snapshots.length}, failed=${errors.length}.`
    });

    return {
      mode: refreshMode,
      requested: steamAppIds.length,
      refreshed: snapshots.length,
      failed: errors.length,
      errors,
      snapshots
    };
  }

  private async refreshSteamAppIds(
    steamAppIds: number[],
    limit: number
  ): Promise<{ snapshots: PlayerCountSnapshot[]; errors: PlayerCountRefreshError[] }> {
    const snapshots: PlayerCountSnapshot[] = [];
    const errors: PlayerCountRefreshError[] = [];

    for (const steamAppId of steamAppIds.slice(0, limit)) {
      try {
        const snapshot = await steamApiService.refreshPlayerCount(steamAppId);
        if (snapshot) {
          snapshots.push(snapshot);
        } else {
          errors.push({ steamAppId, message: "No player snapshot was stored." });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown player refresh error.";
        errors.push({ steamAppId, message });
        await repositories.diagnostics.recordIntegrationLog({
          service: "steam",
          level: "warning",
          message: `Player-count refresh failed for app ${steamAppId}: ${message}`
        });
      }
    }

    return { snapshots, errors };
  }

  private async resolveSteamAppIds(mode: PlayerCountRefreshMode, limit: number): Promise<number[]> {
    if (mode === "watchlist") {
      const items = await repositories.watchlist.list();
      return unique(items.map((item) => item.summary?.game.steamAppId).filter((value): value is number => typeof value === "number")).slice(0, limit);
    }

    if (mode === "all-imported") {
      const games = await repositories.games.listImported(limit);
      return unique(games.map((game) => game.steamAppId)).slice(0, limit);
    }

    const summaries = await repositories.games.mostActive(limit);
    return unique(summaries.map((summary) => summary.game.steamAppId)).slice(0, limit);
  }
}

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

export const playerCountRefreshService = new PlayerCountRefreshService();
