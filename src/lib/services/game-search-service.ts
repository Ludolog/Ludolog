import { repositories } from "@/lib/repositories";
import { steamAppCatalogService } from "@/lib/services/steam-app-catalog-service";
import type { Game, GameProfile, GameSummary } from "@/lib/types";
import type {
  ApiGame,
  ApiGameSearchResult,
  ApiImportGameRequest,
  ApiImportGameResponse
} from "@shared/api-types";

export class GameSearchService {
  list(): Promise<Game[]> {
    return repositories.games.list();
  }

  search(query: string): Promise<GameSummary[]> {
    return repositories.games.search(query);
  }

  async searchCatalog(query: string): Promise<ApiGameSearchResult[]> {
    const [localResults, catalogResults] = await Promise.all([
      repositories.games.search(query),
      Promise.resolve(steamAppCatalogService.search(query, 16))
    ]);
    const seenSteamIds = new Set<number>();
    const results: ApiGameSearchResult[] = [];

    for (const summary of localResults) {
      seenSteamIds.add(summary.game.steamAppId);
      results.push({
        kind: "library",
        importable: false,
        game: toApiGame(summary.game),
        summary: summary as unknown as ApiGameSearchResult["summary"],
        currentPlayers: summary.latestPlayers?.playersOnline ?? 0,
        currentPrice: summary.latestPrice?.price ?? summary.bestOffer?.price ?? 0,
        historicalLow: summary.latestPrice?.historicalLow ?? 0,
        tags: summary.game.genres
      });
    }

    for (const catalogGame of catalogResults) {
      if (seenSteamIds.has(catalogGame.steamAppId)) {
        continue;
      }

      const existing = await repositories.games.findBySteamAppId(catalogGame.steamAppId);
      if (existing) {
        const summary = await repositories.games.getSummary(existing.id);
        if (summary) {
          seenSteamIds.add(existing.steamAppId);
          results.push({
            kind: "library",
            importable: false,
            game: toApiGame(existing),
            summary: summary as unknown as ApiGameSearchResult["summary"],
            currentPlayers: summary.latestPlayers?.playersOnline ?? 0,
            currentPrice: summary.latestPrice?.price ?? summary.bestOffer?.price ?? 0,
            historicalLow: summary.latestPrice?.historicalLow ?? 0,
            tags: existing.genres
          });
        }
        continue;
      }

      seenSteamIds.add(catalogGame.steamAppId);
      results.push({
        kind: "catalog",
        importable: true,
        game: toApiGame({
          ...catalogGame,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        summary: null,
        currentPlayers: catalogGame.currentPlayers,
        currentPrice: catalogGame.currentPrice,
        historicalLow: catalogGame.historicalLow,
        tags: catalogGame.genres
      });
    }

    return results;
  }

  async importGame(request: ApiImportGameRequest): Promise<ApiImportGameResponse> {
    const catalogGame =
      typeof request.steamAppId === "number"
        ? steamAppCatalogService.findBySteamAppId(request.steamAppId)
        : request.slug
          ? steamAppCatalogService.findBySlug(request.slug)
          : null;

    if (!catalogGame) {
      throw new Error("Game is not available in the Steam mock catalog.");
    }

    const existing = await repositories.games.findBySteamAppId(catalogGame.steamAppId);
    if (existing) {
      const summary = await repositories.games.getSummary(existing.id);
      if (!summary) {
        throw new Error("Existing game could not be summarized.");
      }
      return { imported: false, summary: summary as unknown as ApiImportGameResponse["summary"] };
    }

    const summary = await repositories.games.importFromCatalog(catalogGame);
    await repositories.diagnostics.recordIntegrationLog({
      service: "search",
      level: "info",
      message: `Imported ${catalogGame.title} from the Steam fallback catalog.`
    });

    return { imported: true, summary: summary as unknown as ApiImportGameResponse["summary"] };
  }

  findGame(id: string): Promise<Game | null> {
    return repositories.games.findById(id);
  }

  getProfile(id: string): Promise<GameProfile | null> {
    return repositories.games.getProfile(id);
  }

  getSummary(id: string): Promise<GameSummary | null> {
    return repositories.games.getSummary(id);
  }

  bestDeals(limit?: number): Promise<GameSummary[]> {
    return repositories.games.bestDeals(limit);
  }

  mostActive(limit?: number): Promise<GameSummary[]> {
    return repositories.games.mostActive(limit);
  }
}

function toApiGame(game: Game): ApiGame {
  return {
    ...game,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString()
  };
}

export const gameSearchService = new GameSearchService();
