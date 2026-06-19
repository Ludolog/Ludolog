import { repositories } from "@/lib/repositories";
import { steamApiService } from "@/lib/services/steam-api-service";
import { steamAppCatalogService } from "@/lib/services/steam-app-catalog-service";
import type { Game, GameImportInput, GameProfile, GameSummary, SteamCatalogEntry } from "@/lib/types";
import type {
  ApiGame,
  ApiGameSearchResult,
  ApiImportGameSource,
  ApiImportGameRequest,
  ApiImportGameResponse,
  SearchResponse
} from "@shared/api-types";

type ResolvedCatalogGame = {
  input: GameImportInput;
  source: Exclude<ApiImportGameSource, "library">;
};

type ImportGameOptions = {
  refreshPlayers?: boolean;
};

type SearchCatalogOptions = {
  limit?: number;
  offset?: number;
};

export class GameImportNotFoundError extends Error {
  constructor(message = "Game is not available in the Steam catalog or mock fallback catalog.") {
    super(message);
    this.name = "GameImportNotFoundError";
  }
}

export class GameSearchService {
  list(): Promise<Game[]> {
    return repositories.games.list();
  }

  search(query: string): Promise<GameSummary[]> {
    return repositories.games.search(query);
  }

  async searchCatalog(query: string, options: SearchCatalogOptions = {}): Promise<SearchResponse> {
    const limit = Math.min(Math.max(options.limit ?? 16, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);
    const fetchLimit = Math.min(offset + limit + 25, 150);
    const localResults = await repositories.games.search(query);
    const databaseCatalogResults = await this.searchDatabaseCatalog(query, fetchLimit);
    const fallbackCatalogResults = databaseCatalogResults.length > 0 ? [] : steamAppCatalogService.search(query, fetchLimit);
    const seenSteamIds = new Set<number>();
    const allResults: ApiGameSearchResult[] = [];

    for (const summary of localResults) {
      seenSteamIds.add(summary.game.steamAppId);
      allResults.push(libraryResult(summary));
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
          allResults.push(libraryResult(summary));
        }
        continue;
      }

      seenSteamIds.add(entry.steamAppId);
      allResults.push(catalogResult(gameImportInputFromSteamCatalogEntry(entry), "steam-catalog"));
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
          allResults.push(libraryResult(summary));
        }
        continue;
      }

      seenSteamIds.add(catalogGame.steamAppId);
      allResults.push(catalogResult(catalogGame, "mock-catalog"));
    }

    const results = allResults.slice(offset, offset + limit);
    return {
      query,
      limit,
      offset,
      total: allResults.length,
      nextOffset: offset + limit < allResults.length ? offset + limit : null,
      results
    };
  }

  async importGame(request: ApiImportGameRequest, options: ImportGameOptions = {}): Promise<ApiImportGameResponse> {
    const existing = await this.findExistingImportTarget(request);
    if (existing) {
      const summary = await repositories.games.getSummary(existing.id);
      if (!summary) {
        throw new Error("Existing game could not be summarized.");
      }
      return importResponse(false, "library", summary);
    }

    const resolved = await this.resolveCatalogGame(request);

    if (!resolved) {
      throw new GameImportNotFoundError();
    }

    const { input: catalogGame, source } = resolved;
    let summary = await repositories.games.importFromCatalog(catalogGame);
    if ((options.refreshPlayers ?? true) && catalogGame.source === "steam-api") {
      await steamApiService.refreshPlayerCount(catalogGame.steamAppId);
      summary = (await repositories.games.getSummary(summary.game.id)) ?? summary;
    }
    await repositories.diagnostics.recordIntegrationLog({
      service: "search",
      level: "info",
      message: `Imported ${catalogGame.title} from ${source === "steam-catalog" ? "Steam catalog" : "mock catalog"}.`
    });

    return importResponse(true, source, summary);
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

  private async searchDatabaseCatalog(query: string, limit = 16): Promise<SteamCatalogEntry[]> {
    try {
      return await repositories.steamCatalog.search(query, limit);
    } catch (error) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "search",
        level: "warning",
        message: `Steam catalog database search failed: ${error instanceof Error ? error.message : "unknown error"}.`
      });
      return [];
    }
  }

  private async findExistingImportTarget(request: ApiImportGameRequest): Promise<Game | null> {
    if (typeof request.steamAppId === "number") {
      return repositories.games.findBySteamAppId(request.steamAppId);
    }

    if (request.slug) {
      return repositories.games.findById(request.slug);
    }

    if (request.query) {
      const matches = await repositories.games.search(request.query);
      return matches[0]?.game ?? null;
    }

    return null;
  }

  private async resolveCatalogGame(request: ApiImportGameRequest): Promise<ResolvedCatalogGame | null> {
    if (typeof request.steamAppId === "number") {
      const realEntry = await this.findDatabaseCatalogEntry(request.steamAppId);
      if (realEntry) {
        return { input: gameImportInputFromSteamCatalogEntry(realEntry), source: "steam-catalog" };
      }
      const fallback = steamAppCatalogService.findBySteamAppId(request.steamAppId);
      return fallback ? { input: fallback, source: "mock-catalog" } : null;
    }

    if (request.slug) {
      const fallback = steamAppCatalogService.findBySlug(request.slug);
      return fallback ? { input: fallback, source: "mock-catalog" } : null;
    }

    if (request.query) {
      const databaseCatalogResults = await this.searchDatabaseCatalog(request.query);
      const bestCatalogMatch = pickBestCatalogMatch(databaseCatalogResults, request.query);
      if (bestCatalogMatch) {
        return { input: gameImportInputFromSteamCatalogEntry(bestCatalogMatch), source: "steam-catalog" };
      }

      const fallback = steamAppCatalogService.search(request.query, 1)[0];
      return fallback ? { input: fallback, source: "mock-catalog" } : null;
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

function importResponse(
  created: boolean,
  source: ApiImportGameSource,
  summary: GameSummary
): ApiImportGameResponse {
  return {
    imported: created,
    created,
    source,
    steamAppId: summary.game.steamAppId,
    gameId: summary.game.id,
    summary: summary as unknown as ApiImportGameResponse["summary"]
  };
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

function pickBestCatalogMatch(entries: SteamCatalogEntry[], query: string): SteamCatalogEntry | null {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    entries.find((entry) => entry.title.toLowerCase() === normalizedQuery) ??
    entries.find((entry) => entry.title.toLowerCase().startsWith(normalizedQuery)) ??
    entries[0] ??
    null
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const gameSearchService = new GameSearchService();
