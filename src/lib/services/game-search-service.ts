import { repositories } from "@/lib/repositories";
import { isDevMockFallbackEnabled } from "@/lib/config";
import { publicGameProfile, publicGameSummary } from "@/lib/services/public-data-service";
import { steamApiService } from "@/lib/services/steam-api-service";
import { steamAppCatalogService } from "@/lib/services/steam-app-catalog-service";
import type { CatalogStoreOffer, Game, GameImportInput, GameProfile, GameSummary, SteamCatalogEntry } from "@/lib/types";
import type {
  ApiCatalogStoreOffer,
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
  constructor(message = "Game is not available in the Steam catalog.") {
    super(message);
    this.name = "GameImportNotFoundError";
  }
}

export class GameSearchService {
  list(): Promise<Game[]> {
    return repositories.games.list();
  }

  async search(query: string): Promise<GameSummary[]> {
    return (await repositories.games.search(query)).map(publicGameSummary);
  }

  async searchCatalog(query: string, options: SearchCatalogOptions = {}): Promise<SearchResponse> {
    const limit = Math.min(Math.max(options.limit ?? 16, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);
    const fetchLimit = Math.min(offset + limit + 25, 150);
    const allowMockFallback = isDevMockFallbackEnabled();
    const localResults = await repositories.games.search(query);
    const databaseCatalogResults = await this.searchDatabaseCatalog(query, fetchLimit);
    const fallbackCatalogResults = allowMockFallback && databaseCatalogResults.length === 0 ? steamAppCatalogService.search(query, fetchLimit) : [];
    const catalogOffers = await repositories.catalogOffers.findBySteamAppIds([
      ...databaseCatalogResults.map((entry) => entry.steamAppId),
      ...fallbackCatalogResults.map((entry) => entry.steamAppId)
    ]);
    const catalogOfferBySteamAppId = new Map(catalogOffers.map((offer) => [offer.steamAppId, offer]));
    const seenSteamIds = new Set<number>();
    const allResults: ApiGameSearchResult[] = [];

    for (const summary of localResults) {
      seenSteamIds.add(summary.game.steamAppId);
      allResults.push(libraryResult(publicGameSummary(summary)));
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
          allResults.push(libraryResult(publicGameSummary(summary)));
        }
        continue;
      }

      seenSteamIds.add(entry.steamAppId);
      allResults.push(catalogResult(gameImportInputFromSteamCatalogEntry(entry), "steam-catalog", catalogOfferBySteamAppId.get(entry.steamAppId) ?? null));
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
          allResults.push(libraryResult(publicGameSummary(summary)));
        }
        continue;
      }

      seenSteamIds.add(catalogGame.steamAppId);
      allResults.push(catalogResult(catalogGame, "mock-catalog", catalogOfferBySteamAppId.get(catalogGame.steamAppId) ?? null));
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
      return importResponse(false, "library", publicGameSummary(summary));
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

    return importResponse(true, source, publicGameSummary(summary));
  }

  findGame(id: string): Promise<Game | null> {
    return repositories.games.findById(id);
  }

  async getProfile(id: string): Promise<GameProfile | null> {
    const profile = await repositories.games.getProfile(id);
    return profile ? publicGameProfile(profile) : null;
  }

  async getSummary(id: string): Promise<GameSummary | null> {
    const summary = await repositories.games.getSummary(id);
    return summary ? publicGameSummary(summary) : null;
  }

  async bestDeals(limit?: number): Promise<GameSummary[]> {
    return (await repositories.games.bestDeals(limit)).map(publicGameSummary);
  }

  async mostActive(limit?: number): Promise<GameSummary[]> {
    return (await repositories.games.mostActive(limit)).map(publicGameSummary);
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
    const allowMockFallback = isDevMockFallbackEnabled();
    if (typeof request.steamAppId === "number") {
      const realEntry = await this.findDatabaseCatalogEntry(request.steamAppId);
      if (realEntry) {
        return { input: gameImportInputFromSteamCatalogEntry(realEntry), source: "steam-catalog" };
      }
      if (!allowMockFallback) {
        return null;
      }
      const fallback = steamAppCatalogService.findBySteamAppId(request.steamAppId);
      return fallback ? { input: fallback, source: "mock-catalog" } : null;
    }

    if (request.slug) {
      if (!allowMockFallback) {
        return null;
      }
      const fallback = steamAppCatalogService.findBySlug(request.slug);
      return fallback ? { input: fallback, source: "mock-catalog" } : null;
    }

    if (request.query) {
      const databaseCatalogResults = await this.searchDatabaseCatalog(request.query);
      const bestCatalogMatch = pickBestCatalogMatch(databaseCatalogResults, request.query);
      if (bestCatalogMatch) {
        return { input: gameImportInputFromSteamCatalogEntry(bestCatalogMatch), source: "steam-catalog" };
      }

      if (!allowMockFallback) {
        return null;
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
  const lastUpdatedAt = summary.latestPrice?.capturedAt ?? summary.bestOffer?.fetchedAt ?? null;
  return {
    kind: "library",
    importable: false,
    source: "database",
    game: toApiGame(summary.game),
    summary: summary as unknown as ApiGameSearchResult["summary"],
    currentPlayers: summary.latestPlayers?.playersOnline ?? 0,
    currentPrice: summary.latestPrice?.price ?? summary.bestOffer?.price ?? 0,
    historicalLow: summary.latestPrice?.historicalLow ?? 0,
    catalogOffer: null,
    lastUpdatedAt: lastUpdatedAt?.toISOString() ?? null,
    freshness: lastUpdatedAt ? freshness(lastUpdatedAt) : "no-data",
    nextRefreshAt: lastUpdatedAt ? new Date(lastUpdatedAt.getTime() + 6 * 60 * 60 * 1000).toISOString() : null,
    dataSource: summary.latestPrice?.source ?? summary.bestOffer?.source ?? "none",
    confidence: summary.latestPrice?.sourceConfidence ?? summary.bestOffer?.sourceConfidence ?? "no-price-data",
    tags: summary.game.genres
  };
}

function catalogResult(input: GameImportInput, source: ApiGameSearchResult["source"], catalogOffer: CatalogStoreOffer | null): ApiGameSearchResult {
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
    currentPrice: catalogOffer?.price ?? input.currentPrice,
    historicalLow: catalogOffer?.price ?? input.historicalLow,
    catalogOffer: catalogOffer ? toApiCatalogStoreOffer(catalogOffer) : null,
    lastUpdatedAt: catalogOffer?.fetchedAt.toISOString() ?? null,
    freshness: catalogOffer?.freshness ?? "no-data",
    nextRefreshAt: catalogOffer ? new Date(catalogOffer.fetchedAt.getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
    dataSource: catalogOffer?.provider === "steam-store" ? "steam-store" : "none",
    confidence: catalogOffer?.sourceConfidence ?? "no-price-data",
    tags: input.genres
  };
}

function toApiCatalogStoreOffer(offer: CatalogStoreOffer): ApiCatalogStoreOffer {
  return {
    id: offer.id,
    steamAppId: offer.steamAppId,
    gogProductId: offer.gogProductId,
    catalogSource: offer.catalogSource,
    gameId: offer.gameId,
    provider: offer.provider,
    storeName: offer.storeName,
    storeType: offer.storeType,
    title: offer.title,
    price: offer.price,
    regularPrice: offer.regularPrice,
    currency: offer.currency,
    discountPercent: offer.discountPercent,
    externalUrl: offer.externalUrl,
    countryCode: offer.countryCode,
    available: offer.available,
    drm: offer.drm,
    sourceRawId: offer.sourceRawId,
    fetchedAt: offer.fetchedAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    sourceConfidence: offer.sourceConfidence,
    sourceName: offer.sourceName,
    freshness: offer.freshness
  };
}

function freshness(date: Date): "fresh" | "stale" | "no-data" {
  return Date.now() - date.getTime() > 24 * 60 * 60 * 1000 ? "stale" : "fresh";
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
