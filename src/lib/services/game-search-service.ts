import { repositories } from "@/lib/repositories";
import { steamApiService } from "@/lib/services/steam-api-service";
import { steamAppCatalogService } from "@/lib/services/steam-app-catalog-service";
import type { Game, GameImportInput, GameProfile, GameSummary, SteamCatalogEntry } from "@/lib/types";
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
    const localResults = await repositories.games.search(query);
    const databaseCatalogResults = await this.searchDatabaseCatalog(query);
    const fallbackCatalogResults = databaseCatalogResults.length > 0 ? [] : steamAppCatalogService.search(query, 16);
    const seenSteamIds = new Set<number>();
    const results: ApiGameSearchResult[] = [];

    for (const summary of localResults) {
      seenSteamIds.add(summary.game.steamAppId);
      results.push(libraryResult(summary));
    }

    for (const entry of databaseCatalogResults) {
      if (seenSteamIds.has(entry.steamAppId)) {
        continue;
      }

      const existing = await repositories.games.findBySteamAppId(entry.steamAppId);
      if (existing) {
        const summary = await repositories.games.getSummary(existing.id);
        if (summary) {
          seenSteamIds.add(existing.steamAppId);
          results.push(libraryResult(summary));
        }
        continue;
      }

      seenSteamIds.add(entry.steamAppId);
      results.push(catalogResult(gameImportInputFromSteamCatalogEntry(entry), "steam-catalog"));
    }

    for (const catalogGame of fallbackCatalogResults) {
      if (seenSteamIds.has(catalogGame.steamAppId)) {
        continue;
      }

      const existing = await repositories.games.findBySteamAppId(catalogGame.steamAppId);
      if (existing) {
        const summary = await repositories.games.getSummary(existing.id);
        if (summary) {
          seenSteamIds.add(existing.steamAppId);
          results.push(libraryResult(summary));
        }
        continue;
      }

      seenSteamIds.add(catalogGame.steamAppId);
      results.push(catalogResult(catalogGame, "mock-catalog"));
    }

    return results;
  }

  async importGame(request: ApiImportGameRequest): Promise<ApiImportGameResponse> {
    const catalogGame = await this.resolveCatalogGame(request);

    if (!catalogGame) {
      throw new Error("Game is not available in the Steam catalog or mock fallback catalog.");
    }

    const existing = await repositories.games.findBySteamAppId(catalogGame.steamAppId);
    if (existing) {
      const summary = await repositories.games.getSummary(existing.id);
      if (!summary) {
        throw new Error("Existing game could not be summarized.");
      }
      return { imported: false, summary: summary as unknown as ApiImportGameResponse["summary"] };
    }

    let summary = await repositories.games.importFromCatalog(catalogGame);
    if (catalogGame.source === "steam-api") {
      await steamApiService.refreshPlayerCount(catalogGame.steamAppId);
      summary = (await repositories.games.getSummary(summary.game.id)) ?? summary;
    }
    await repositories.diagnostics.recordIntegrationLog({
      service: "search",
      level: "info",
      message: `Imported ${catalogGame.title} from ${catalogGame.source === "steam-api" ? "Steam catalog" : "mock catalog"}.`
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

  private async searchDatabaseCatalog(query: string): Promise<SteamCatalogEntry[]> {
    try {
      return await repositories.steamCatalog.search(query, 16);
    } catch (error) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "search",
        level: "warning",
        message: `Steam catalog database search failed: ${error instanceof Error ? error.message : "unknown error"}.`
      });
      return [];
    }
  }

  private async resolveCatalogGame(request: ApiImportGameRequest): Promise<GameImportInput | null> {
    if (typeof request.steamAppId === "number") {
      const realEntry = await this.findDatabaseCatalogEntry(request.steamAppId);
      if (realEntry) {
        return gameImportInputFromSteamCatalogEntry(realEntry);
      }
      return steamAppCatalogService.findBySteamAppId(request.steamAppId);
    }

    if (request.slug) {
      return steamAppCatalogService.findBySlug(request.slug);
    }

    return null;
  }

  private async findDatabaseCatalogEntry(steamAppId: number): Promise<SteamCatalogEntry | null> {
    try {
      return await repositories.steamCatalog.findBySteamAppId(steamAppId);
    } catch (error) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "search",
        level: "warning",
        message: `Steam catalog lookup failed for app ${steamAppId}: ${
          error instanceof Error ? error.message : "unknown error"
        }.`
      });
      return null;
    }
  }
}

function libraryResult(summary: GameSummary): ApiGameSearchResult {
  return {
    kind: "library",
    importable: false,
    source: "database",
    game: toApiGame(summary.game),
    summary: summary as unknown as ApiGameSearchResult["summary"],
    currentPlayers: summary.latestPlayers?.playersOnline ?? 0,
    currentPrice: summary.latestPrice?.price ?? summary.bestOffer?.price ?? 0,
    historicalLow: summary.latestPrice?.historicalLow ?? 0,
    tags: summary.game.genres
  };
}

function catalogResult(input: GameImportInput, source: ApiGameSearchResult["source"]): ApiGameSearchResult {
  return {
    kind: "catalog",
    importable: true,
    source,
    game: toApiGame({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    summary: null,
    currentPlayers: input.currentPlayers,
    currentPrice: input.currentPrice,
    historicalLow: input.historicalLow,
    tags: input.genres
  };
}

function gameImportInputFromSteamCatalogEntry(entry: SteamCatalogEntry): GameImportInput {
  const slug = slugify(entry.title) || `steam-app-${entry.steamAppId}`;
  return {
    id: slug,
    steamAppId: entry.steamAppId,
    title: entry.title,
    slug,
    platform: "Steam",
    description: `${entry.title} imported from the Steam catalog. Player activity can be refreshed from Steam Web API.`,
    coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${entry.steamAppId}/header.jpg`,
    genres: ["Steam"],
    developer: "Unknown",
    publisher: "Unknown",
    releaseDate: "1970-01-01",
    reviewScore: 70,
    source: "steam-api",
    basePrice: 0,
    currentPrice: 0,
    historicalLow: 0,
    currentPlayers: 0,
    trendFactor: 1
  };
}

function toApiGame(game: Game): ApiGame {
  return {
    ...game,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString()
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const gameSearchService = new GameSearchService();
