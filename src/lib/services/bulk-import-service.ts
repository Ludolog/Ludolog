import { repositories } from "@/lib/repositories";
import { gameSearchService } from "@/lib/services/game-search-service";
import { steamApiService } from "@/lib/services/steam-api-service";
import type { ApiBulkImportResponse, ApiImportGameRequest } from "@shared/api-types";

export type BulkImportOptions = {
  limit?: number;
  queries?: string[];
  refreshPlayers?: boolean;
  steamAppIds?: number[];
};

type BulkImportTarget = {
  input: string;
  request: ApiImportGameRequest;
};

export class BulkImportService {
  async importGames(options: BulkImportOptions): Promise<ApiBulkImportResponse> {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 20)));
    const refreshPlayers = options.refreshPlayers ?? true;
    const targets = buildTargets(options).slice(0, limit);
    const response: ApiBulkImportResponse = {
      imported: 0,
      skipped: 0,
      refreshed: 0,
      failed: 0,
      errors: [],
      results: []
    };

    for (const target of targets) {
      try {
        const imported = await gameSearchService.importGame(target.request, { refreshPlayers: false });
        let refreshed = false;

        if (refreshPlayers) {
          const snapshot = await steamApiService.refreshPlayerCount(imported.steamAppId);
          refreshed = snapshot !== null;
          if (refreshed) {
            response.refreshed += 1;
          }
        }

        if (imported.created) {
          response.imported += 1;
        } else {
          response.skipped += 1;
        }

        response.results.push({
          input: target.input,
          created: imported.created,
          source: imported.source,
          steamAppId: imported.steamAppId,
          gameId: imported.gameId,
          title: imported.summary.game.title,
          refreshed
        });
      } catch (error) {
        response.failed += 1;
        response.errors.push({
          input: target.input,
          message: error instanceof Error ? error.message : "Unknown import error."
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "search",
      level: response.failed > 0 ? "warning" : "info",
      message: `Bulk import finished. requested=${targets.length}, imported=${response.imported}, skipped=${response.skipped}, refreshed=${response.refreshed}, failed=${response.failed}.`
    });

    return response;
  }
}

function buildTargets(options: BulkImportOptions): BulkImportTarget[] {
  const targets: BulkImportTarget[] = [];
  const seen = new Set<string>();

  for (const steamAppId of options.steamAppIds ?? []) {
    const key = `appid:${steamAppId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    targets.push({ input: String(steamAppId), request: { steamAppId } });
  }

  for (const query of options.queries ?? []) {
    const trimmed = query.trim();
    if (!trimmed) {
      continue;
    }
    const key = `query:${trimmed.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    targets.push({ input: trimmed, request: { query: trimmed } });
  }

  return targets;
}

export const bulkImportService = new BulkImportService();
