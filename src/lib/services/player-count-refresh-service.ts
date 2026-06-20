import { getPlayerCountStaleMinutes } from "@/lib/config";
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
  source: "steam";
  dryRun: false;
  requested: number;
  refreshed: number;
  skippedFreshCache: number;
  failed: number;
  errors: PlayerCountRefreshError[];
  snapshots: PlayerCountSnapshot[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type PlayerCountRefreshOptions = {
  maxRuntimeMs?: number;
  staleMs?: number;
};

export class PlayerCountRefreshService {
  async refresh(
    mode: PlayerCountRefreshMode,
    limit = 25,
    explicitSteamAppIds?: number[],
    options: PlayerCountRefreshOptions = {}
  ): Promise<PlayerCountRefreshResult> {
    const started = Date.now();
    const startedAt = new Date(started);
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const refreshMode: PlayerCountRefreshRuntimeMode = explicitSteamAppIds && explicitSteamAppIds.length > 0 ? "explicit" : mode;
    const steamAppIds = explicitSteamAppIds && explicitSteamAppIds.length > 0
      ? unique(explicitSteamAppIds).slice(0, safeLimit)
      : await this.resolveSteamAppIds(mode, safeLimit);
    const { errors, snapshots, skippedFreshCache } = await this.refreshSteamAppIds(steamAppIds, safeLimit, started, options);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: errors.length > 0 ? "warning" : "info",
      message: `Player-count refresh finished. mode=${refreshMode}, requested=${steamAppIds.length}, refreshed=${snapshots.length}, skippedFreshCache=${skippedFreshCache}, failed=${errors.length}, durationMs=${durationMs}.`
    });

    return {
      mode: refreshMode,
      source: "steam",
      dryRun: false,
      requested: steamAppIds.length,
      refreshed: snapshots.length,
      skippedFreshCache,
      failed: errors.length,
      errors,
      snapshots,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs
    };
  }

  private async refreshSteamAppIds(
    steamAppIds: number[],
    limit: number,
    started: number,
    options: PlayerCountRefreshOptions
  ): Promise<{ snapshots: PlayerCountSnapshot[]; errors: PlayerCountRefreshError[]; skippedFreshCache: number }> {
    const snapshots: PlayerCountSnapshot[] = [];
    const errors: PlayerCountRefreshError[] = [];
    let skippedFreshCache = 0;
    const maxRuntimeMs = options.maxRuntimeMs ?? 25_000;
    const staleMs = options.staleMs ?? getPlayerCountStaleMinutes() * 60 * 1000;

    for (const steamAppId of steamAppIds.slice(0, limit)) {
      if (Date.now() - started > maxRuntimeMs) {
        errors.push({ steamAppId, message: "Player-count refresh stopped at max runtime." });
        break;
      }
      try {
        const latest = await repositories.snapshots.latestPlayersBySteamAppId(steamAppId);
        if (latest && Date.now() - latest.capturedAt.getTime() < staleMs) {
          skippedFreshCache += 1;
          continue;
        }
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

    return { snapshots, errors, skippedFreshCache };
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
