import { repositories } from "@/lib/repositories";
import { steamApiService } from "@/lib/services/steam-api-service";
import type { PlayerCountSnapshot } from "@/lib/types";

export type PlayerCountRefreshMode = "watchlist" | "top" | "all-imported";

export type PlayerCountRefreshResult = {
  mode: PlayerCountRefreshMode;
  requested: number;
  refreshed: number;
  snapshots: PlayerCountSnapshot[];
};

export class PlayerCountRefreshService {
  async refresh(mode: PlayerCountRefreshMode, limit = 25): Promise<PlayerCountRefreshResult> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const steamAppIds = await this.resolveSteamAppIds(mode, safeLimit);
    const snapshots = await steamApiService.refreshManyPlayerCounts(steamAppIds, safeLimit);

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: "info",
      message: `Player-count refresh finished. mode=${mode}, requested=${steamAppIds.length}, refreshed=${snapshots.length}.`
    });

    return {
      mode,
      requested: steamAppIds.length,
      refreshed: snapshots.length,
      snapshots
    };
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
