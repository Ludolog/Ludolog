import {
  getSteamStoreApiBaseUrl,
  getSteamStoreCountryCode,
  getTopGamesStalePlayerHours,
  getTopGamesStalePriceHours
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { GameTagNormalizer } from "@/lib/services/category-service";
import { steamApiService } from "@/lib/services/steam-api-service";
import { steamStorePriceService } from "@/lib/services/steam-store-price-service";
import { publicGameProfile, publicPlayerSnapshot } from "@/lib/services/public-data-service";
import { curatedTopTrackedGames } from "@/lib/top-games-seed";
import type {
  CatalogStoreOffer,
  Game,
  GameImportInput,
  GamePriceSnapshot,
  GameProfile,
  PlayerCountSnapshot,
  SteamCatalogEntry,
  StoreOffer,
  TopTrackedGame
} from "@/lib/types";
import type {
  ApiSteamStorePriceRefreshResult,
  ApiTopGameItem,
  ApiTopGamesBootstrapResponse,
  ApiTopGamesCoverage,
  ApiTopGamesImportResponse,
  ApiTopGamesRefreshPlayersResponse,
  ApiTopGamesRefreshPricesResponse,
  ApiTopGamesResponse,
  TopGameFreshness,
  TopGameRecommendation
} from "@shared/api-types";

type TopGamesListOptions = {
  limit?: number;
  offset?: number;
  sort?: "players" | "score" | "price" | "discount" | "freshness";
  category?: string;
};

type TopGameEntryWithGame = {
  entry: TopTrackedGame;
  game: Game | null;
  profile: GameProfile | null;
  latestPlayers: PlayerCountSnapshot | null;
  steamPrice: TopSteamPrice | null;
};

type TopSteamPrice = GamePriceSnapshot | StoreOffer | CatalogStoreOffer;

type TopGamesImportSource = ApiTopGamesImportResponse["results"][number]["sourceUsed"];

type ImportPlan =
  | {
      kind: "existing";
      entry: TopTrackedGame;
      game: Game;
    }
  | {
      kind: "steam-catalog";
      entry: TopTrackedGame;
      catalogEntry: SteamCatalogEntry;
    }
  | {
      kind: "fallback";
      entry: TopTrackedGame;
    };

type SteamStoreAppDetailsPayload = Record<
  string,
  {
    success?: boolean;
    data?: {
      name?: string;
      type?: string;
      header_image?: string;
      short_description?: string;
      developers?: string[];
      publishers?: string[];
      release_date?: {
        date?: string;
      };
      genres?: Array<{
        description?: string;
      }>;
    };
  }
>;

type SteamStoreTopGameDetails = NonNullable<SteamStoreAppDetailsPayload[string]["data"]>;

export class TopGamesService {
  async list(options: TopGamesListOptions = {}): Promise<ApiTopGamesResponse> {
    const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 100)));
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const sort = options.sort ?? "players";
    const rows = await this.loadRows(100, false);
    const items = rows.map((row, index) => toTopGameItem(row, index + 1));
    const filtered = options.category ? items.filter((item) => item.categories.includes(options.category as string)) : items;
    const sorted = sortTopGames(filtered, sort);

    return {
      items: sorted.slice(offset, offset + limit).map((item, index) => ({ ...item, rank: offset + index + 1 })),
      total: filtered.length,
      limit,
      offset,
      sort,
      updatedAt: new Date().toISOString(),
      coverage: coverageForItems(items)
    };
  }

  async coverage(): Promise<ApiTopGamesCoverage> {
    const rows = await this.loadRows(100, false);
    return coverageForItems(rows.map((row, index) => toTopGameItem(row, index + 1)));
  }

  async importTopGames(input: { limit?: number; dryRun?: boolean }): Promise<ApiTopGamesImportResponse> {
    const dryRun = input.dryRun ?? true;
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
    const entries = await this.resolveTopEntries(limit, !dryRun);
    const response: ApiTopGamesImportResponse = {
      dryRun,
      requested: entries.length,
      imported: 0,
      alreadyExisting: 0,
      createdFromSteamCatalog: 0,
      createdFromSteamStore: 0,
      createdFromCuratedFallback: 0,
      missingMetadata: 0,
      missingFromSteamCatalog: 0,
      failed: 0,
      errors: [],
      results: []
    };
    const plans: ImportPlan[] = [];

    for (const entry of entries) {
      try {
        const existing = await repositories.games.findBySteamAppId(entry.steamAppId);
        if (existing) {
          plans.push({ kind: "existing", entry, game: existing });
          continue;
        }

        const catalogEntry = await repositories.steamCatalog.findBySteamAppId(entry.steamAppId);
        if (catalogEntry?.isGame && catalogEntry.isActive) {
          plans.push({ kind: "steam-catalog", entry, catalogEntry });
          continue;
        }

        plans.push({ kind: "fallback", entry });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown TOP 100 import error.";
        response.failed += 1;
        response.errors.push({ steamAppId: entry.steamAppId, title: entry.title, message });
        response.results.push({
          steamAppId: entry.steamAppId,
          title: entry.title,
          gameId: null,
          imported: false,
          alreadyExisting: false,
          sourceUsed: "curated-top-100",
          missingFromSteamCatalog: false,
          message
        });
      }
    }

    const fallbackDetails = await fetchSteamStoreDetails(
      plans.filter((plan): plan is Extract<ImportPlan, { kind: "fallback" }> => plan.kind === "fallback").map((plan) => plan.entry)
    );

    for (const plan of plans) {
      try {
        if (plan.kind === "existing") {
          if (!dryRun) {
            await repositories.topTrackedGames.linkGame(plan.entry.steamAppId, plan.game.id);
          }
          response.alreadyExisting += 1;
          response.results.push({
            steamAppId: plan.entry.steamAppId,
            title: plan.game.title,
            gameId: plan.game.id,
            imported: false,
            alreadyExisting: true,
            sourceUsed: "existing-game",
            missingFromSteamCatalog: false,
            message: "Game already exists in tracked Game table."
          });
          continue;
        }

        if (plan.kind === "steam-catalog") {
          await this.completeImportPlan({
            entry: plan.entry,
            sourceUsed: "steam-catalog",
            missingFromSteamCatalog: false,
            input: gameImportInputFromSteamCatalogEntry(plan.catalogEntry),
            dryRun,
            response,
            message: dryRun
              ? "Dry run only; this game would be imported from SteamCatalogEntry."
              : "Imported from SteamCatalogEntry."
          });
          response.createdFromSteamCatalog += 1;
          continue;
        }

        response.missingFromSteamCatalog += 1;
        const steamStoreDetails = fallbackDetails.get(plan.entry.steamAppId) ?? null;
        if (steamStoreDetails) {
          await this.completeImportPlan({
            entry: plan.entry,
            sourceUsed: "steam-store-appdetails",
            missingFromSteamCatalog: true,
            input: gameImportInputFromSteamStoreDetails(plan.entry, steamStoreDetails),
            catalogEntry: steamCatalogEntryFromTopGame(plan.entry, steamStoreDetails),
            dryRun,
            response,
            message: dryRun
              ? "Dry run only; this game would be imported from Steam Store appdetails."
              : "Imported from Steam Store appdetails fallback."
          });
          response.createdFromSteamStore += 1;
          continue;
        }

        await this.completeImportPlan({
          entry: plan.entry,
          sourceUsed: "curated-top-100",
          missingFromSteamCatalog: true,
          input: gameImportInputFromCuratedTopGame(plan.entry),
          catalogEntry: steamCatalogEntryFromTopGame(plan.entry, null),
          dryRun,
          response,
          message: dryRun
            ? "Dry run only; this game would be imported from curated TOP 100 fallback metadata."
            : "Imported from curated TOP 100 fallback metadata."
        });
        response.createdFromCuratedFallback += 1;
        response.missingMetadata += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown TOP 100 import error.";
        response.failed += 1;
        response.errors.push({ steamAppId: plan.entry.steamAppId, title: plan.entry.title, message });
        response.results.push({
          steamAppId: plan.entry.steamAppId,
          title: plan.entry.title,
          gameId: null,
          imported: false,
          alreadyExisting: false,
          sourceUsed: plan.kind === "steam-catalog" ? "steam-catalog" : "curated-top-100",
          missingFromSteamCatalog: plan.kind !== "steam-catalog",
          message
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "search",
      level: response.failed > 0 ? "warning" : "info",
      message: `TOP 100 import finished. dryRun=${dryRun}, requested=${response.requested}, imported=${response.imported}, alreadyExisting=${response.alreadyExisting}, createdFromSteamCatalog=${response.createdFromSteamCatalog}, createdFromSteamStore=${response.createdFromSteamStore}, createdFromCuratedFallback=${response.createdFromCuratedFallback}, missingMetadata=${response.missingMetadata}, missingFromSteamCatalog=${response.missingFromSteamCatalog}, failed=${response.failed}.`
    });

    return response;
  }

  async refreshPlayers(input: { limit?: number; dryRun?: boolean }): Promise<ApiTopGamesRefreshPlayersResponse> {
    const dryRun = input.dryRun ?? true;
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
    const entries = await this.resolveTopEntries(limit, !dryRun);
    const response: ApiTopGamesRefreshPlayersResponse = {
      dryRun,
      requested: entries.length,
      refreshed: 0,
      skippedFreshCache: 0,
      noData: 0,
      failed: 0,
      createdSnapshots: 0,
      errors: [],
      results: []
    };
    const staleBefore = new Date(Date.now() - getTopGamesStalePlayerHours() * 60 * 60 * 1000);

    for (const entry of entries) {
      const game = await this.findTopGame(entry);
      if (!game) {
        response.noData += 1;
        response.results.push({
          steamAppId: entry.steamAppId,
          gameId: null,
          refreshed: false,
          skipped: true,
          playersOnline: null,
          snapshotId: null,
          message: "Game is not imported yet."
        });
        continue;
      }

      const latest = publicPlayerSnapshot(await repositories.snapshots.latestPlayersBySteamAppId(entry.steamAppId));
      if (latest && latest.capturedAt >= staleBefore) {
        response.skippedFreshCache += 1;
        response.results.push({
          steamAppId: entry.steamAppId,
          gameId: game.id,
          refreshed: false,
          skipped: true,
          playersOnline: latest.playersOnline,
          snapshotId: latest.id,
          message: "Skipped fresh Steam player cache."
        });
        continue;
      }

      if (dryRun) {
        response.results.push({
          steamAppId: entry.steamAppId,
          gameId: game.id,
          refreshed: false,
          skipped: true,
          playersOnline: latest?.playersOnline ?? null,
          snapshotId: null,
          message: "Dry run only; no Steam player snapshot was written."
        });
        continue;
      }

      try {
        const snapshot = await steamApiService.refreshPlayerCount(entry.steamAppId);
        if (!snapshot) {
          response.noData += 1;
          response.results.push({
            steamAppId: entry.steamAppId,
            gameId: game.id,
            refreshed: false,
            skipped: true,
            playersOnline: null,
            snapshotId: null,
            message: "Steam API did not return player data."
          });
          continue;
        }
        response.refreshed += 1;
        response.createdSnapshots += 1;
        response.results.push({
          steamAppId: entry.steamAppId,
          gameId: game.id,
          refreshed: true,
          skipped: false,
          playersOnline: snapshot.playersOnline,
          snapshotId: snapshot.id,
          message: null
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown TOP 100 player refresh error.";
        response.failed += 1;
        response.errors.push({ steamAppId: entry.steamAppId, gameId: game.id, message });
        response.results.push({
          steamAppId: entry.steamAppId,
          gameId: game.id,
          refreshed: false,
          skipped: false,
          playersOnline: null,
          snapshotId: null,
          message
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: response.failed > 0 ? "warning" : "info",
      message: `TOP 100 player refresh finished. dryRun=${dryRun}, requested=${response.requested}, refreshed=${response.refreshed}, skippedFreshCache=${response.skippedFreshCache}, noData=${response.noData}, failed=${response.failed}.`
    });

    return response;
  }

  async refreshPrices(input: { limit?: number; dryRun?: boolean }): Promise<ApiTopGamesRefreshPricesResponse> {
    const dryRun = input.dryRun ?? true;
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
    if (!dryRun) {
      await this.resolveTopEntries(limit, true);
    }
    const steamResponse = await steamStorePriceService.refreshPrices({
      mode: "top-100",
      limit,
      dryRun
    });
    const warnings = steamResponse.results
      .filter((result) => result.skipped && result.message)
      .map((result) => ({
        steamAppId: result.steamAppId,
        gameId: result.gameId,
        status: result.message?.toLowerCase().includes("fresh") ? "fresh-cache" as const : "no-price" as const,
        message: result.message ?? "Steam Store price skipped."
      }));

    return {
      dryRun,
      requested: steamResponse.requested,
      refreshed: steamResponse.refreshed,
      skippedFreshCache: steamResponse.skippedFreshCache ?? 0,
      skippedNoPrice: steamResponse.skippedNoPrice ?? 0,
      skippedUnsupported: steamResponse.skippedUnsupported ?? 0,
      failed: steamResponse.failed,
      createdOffers: steamResponse.createdOffers ?? 0,
      updatedOffers: steamResponse.updatedOffers ?? 0,
      createdSnapshots: steamResponse.createdSnapshots ?? 0,
      errors: steamResponse.errors,
      warnings,
      results: steamResponse.results as ApiSteamStorePriceRefreshResult[]
    };
  }

  async bootstrap(input: { limit?: number; dryRun?: boolean }): Promise<ApiTopGamesBootstrapResponse> {
    const dryRun = input.dryRun ?? true;
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
    const importReport = await this.importTopGames({ limit, dryRun });
    const players = await this.refreshPlayers({ limit, dryRun });
    const prices = await this.refreshPrices({ limit, dryRun });
    return {
      dryRun,
      requested: limit,
      import: importReport,
      players,
      prices,
      coverage: await this.coverage()
    };
  }

  private async resolveTopEntries(limit: number, persistSeed: boolean): Promise<TopTrackedGame[]> {
    if (persistSeed) {
      await repositories.topTrackedGames.upsertMany(curatedTopTrackedGames());
    }

    const persisted = await repositories.topTrackedGames.listActive(limit);
    if (persisted.length > 0) {
      return persisted;
    }

    const now = new Date();
    return curatedTopTrackedGames().slice(0, limit).map((entry) => ({
      ...entry,
      createdAt: now,
      updatedAt: now
    }));
  }

  private async loadRows(limit: number, persistSeed: boolean): Promise<TopGameEntryWithGame[]> {
    const entries = await this.resolveTopEntries(limit, persistSeed);
    const catalogOffers = await repositories.catalogOffers.findBySteamAppIds(entries.map((entry) => entry.steamAppId));
    return Promise.all(
      entries.map(async (entry) => {
        const game = await this.findTopGame(entry);
        const rawProfile = game ? await repositories.games.getProfile(game.id) : null;
        const profile = rawProfile ? publicGameProfile(rawProfile) : null;
        const latestPlayers = publicPlayerSnapshot(await repositories.snapshots.latestPlayersBySteamAppId(entry.steamAppId)) ?? profile?.latestPlayers ?? null;
        const steamPrice = pickSteamPrice(profile, catalogOffers.find((offer) => offer.steamAppId === entry.steamAppId) ?? null);
        return { entry, game, profile, latestPlayers, steamPrice };
      })
    );
  }

  private async findTopGame(entry: TopTrackedGame): Promise<Game | null> {
    const game = entry.gameId ? await repositories.games.findById(entry.gameId) : await repositories.games.findBySteamAppId(entry.steamAppId);
    if (game && entry.gameId !== game.id) {
      await repositories.topTrackedGames.linkGame(entry.steamAppId, game.id);
    }
    return game;
  }

  private async completeImportPlan(input: {
    entry: TopTrackedGame;
    sourceUsed: TopGamesImportSource;
    missingFromSteamCatalog: boolean;
    input: GameImportInput;
    catalogEntry?: SteamCatalogEntry;
    dryRun: boolean;
    response: ApiTopGamesImportResponse;
    message: string;
  }): Promise<void> {
    if (input.dryRun) {
      input.response.results.push({
        steamAppId: input.entry.steamAppId,
        title: input.input.title,
        gameId: null,
        imported: false,
        alreadyExisting: false,
        sourceUsed: input.sourceUsed,
        missingFromSteamCatalog: input.missingFromSteamCatalog,
        message: input.message
      });
      return;
    }

    if (input.catalogEntry) {
      await repositories.steamCatalog.upsertMany([input.catalogEntry]);
    }
    const summary = await repositories.games.importFromCatalog(input.input);
    await repositories.topTrackedGames.linkGame(input.entry.steamAppId, summary.game.id);
    input.response.imported += 1;
    input.response.results.push({
      steamAppId: input.entry.steamAppId,
      title: summary.game.title,
      gameId: summary.game.id,
      imported: true,
      alreadyExisting: false,
      sourceUsed: input.sourceUsed,
      missingFromSteamCatalog: input.missingFromSteamCatalog,
      message: input.message
    });
  }
}

function pickSteamPrice(profile: GameProfile | null, catalogOffer: CatalogStoreOffer | null): TopSteamPrice | null {
  const steamStoreSnapshot = profile?.priceHistory
    .filter((snapshot) => snapshot.source === "steam-store")
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
  if (steamStoreSnapshot) {
    return steamStoreSnapshot;
  }
  const steamStoreOffer = profile?.offers
    .filter((offer) => offer.source === "steam-store" || offer.source === "manual")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  return steamStoreOffer ?? catalogOffer;
}

async function fetchSteamStoreDetails(entries: TopTrackedGame[]): Promise<Map<number, SteamStoreTopGameDetails>> {
  const results = new Map<number, SteamStoreTopGameDetails>();
  await mapWithConcurrency(entries, 5, async (entry) => {
    const details = await fetchSteamStoreDetailsForEntry(entry.steamAppId);
    if (details) {
      results.set(entry.steamAppId, details);
    }
  });
  return results;
}

async function fetchSteamStoreDetailsForEntry(steamAppId: number): Promise<SteamStoreTopGameDetails | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = new URL(`${getSteamStoreApiBaseUrl()}/appdetails`);
    url.searchParams.set("appids", String(steamAppId));
    url.searchParams.set("cc", getSteamStoreCountryCode());
    url.searchParams.set("filters", "basic");

    const response = await fetch(url.toString(), {
      headers: { accept: "application/json", "user-agent": "GameValueRadar/1.0" },
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.toLowerCase().includes("json")) {
      return null;
    }
    const payload = (await response.json()) as SteamStoreAppDetailsPayload;
    const entry = payload[String(steamAppId)];
    if (!entry?.success || !entry.data?.name) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function gameImportInputFromSteamCatalogEntry(entry: SteamCatalogEntry): GameImportInput {
  return gameImportInput({
    steamAppId: entry.steamAppId,
    title: entry.title,
    description: `${entry.title} imported from the Steam catalog. Player activity can be refreshed from Steam Web API.`,
    coverUrl: steamHeaderImageUrl(entry.steamAppId),
    genres: ["Steam"],
    developer: "Unknown",
    publisher: "Unknown",
    releaseDate: "1970-01-01"
  });
}

function gameImportInputFromSteamStoreDetails(entry: TopTrackedGame, details: SteamStoreTopGameDetails): GameImportInput {
  const title = normalizedTitle(details.name, entry.title);
  return gameImportInput({
    steamAppId: entry.steamAppId,
    title,
    description: details.short_description?.trim() || `${title} imported from Steam Store appdetails for the curated TOP 100 scope.`,
    coverUrl: details.header_image?.trim() || steamHeaderImageUrl(entry.steamAppId),
    genres: normalizeSteamStoreGenres(details),
    developer: details.developers?.filter(Boolean).join(", ") || "Unknown",
    publisher: details.publishers?.filter(Boolean).join(", ") || "Unknown",
    releaseDate: parseSteamStoreReleaseDate(details.release_date?.date)
  });
}

function gameImportInputFromCuratedTopGame(entry: TopTrackedGame): GameImportInput {
  return gameImportInput({
    steamAppId: entry.steamAppId,
    title: entry.title,
    description: `${entry.title} imported from the curated TOP 100 Steam scope. Steam Store metadata was not available during import.`,
    coverUrl: steamHeaderImageUrl(entry.steamAppId),
    genres: ["Steam"],
    developer: "Unknown",
    publisher: "Unknown",
    releaseDate: "1970-01-01"
  });
}

function gameImportInput(input: {
  steamAppId: number;
  title: string;
  description: string;
  coverUrl: string;
  genres: string[];
  developer: string;
  publisher: string;
  releaseDate: string;
}): GameImportInput {
  const slug = slugify(input.title) || `steam-app-${input.steamAppId}`;
  return {
    id: slug,
    steamAppId: input.steamAppId,
    title: input.title,
    slug,
    platform: "Steam",
    description: input.description,
    coverUrl: input.coverUrl,
    genres: input.genres.length > 0 ? input.genres : ["Steam"],
    developer: input.developer,
    publisher: input.publisher,
    releaseDate: input.releaseDate,
    reviewScore: 70,
    source: "steam-api",
    basePrice: 0,
    currentPrice: 0,
    historicalLow: 0,
    currentPlayers: 0,
    trendFactor: 1
  };
}

function steamCatalogEntryFromTopGame(entry: TopTrackedGame, details: SteamStoreTopGameDetails | null): SteamCatalogEntry {
  const now = new Date();
  return {
    id: `steam-catalog-${entry.steamAppId}`,
    steamAppId: entry.steamAppId,
    title: details ? normalizedTitle(details.name, entry.title) : entry.title,
    appType: details?.type?.trim() || "game",
    lastModified: null,
    priceChangeNumber: null,
    isGame: true,
    isActive: true,
    source: "steam-api",
    syncedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeSteamStoreGenres(details: SteamStoreTopGameDetails): string[] {
  const genres = details.genres?.map((genre) => genre.description?.trim()).filter((genre): genre is string => Boolean(genre)) ?? [];
  return genres.length > 0 ? genres : ["Steam"];
}

function parseSteamStoreReleaseDate(value: string | undefined): string {
  if (!value) {
    return "1970-01-01";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "1970-01-01" : parsed.toISOString().slice(0, 10);
}

function normalizedTitle(candidate: string | undefined, fallback: string): string {
  const title = candidate?.trim();
  return title && title.length > 0 ? title : fallback;
}

function steamHeaderImageUrl(steamAppId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/header.jpg`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toTopGameItem(row: TopGameEntryWithGame, rank: number): ApiTopGameItem {
  const { entry, game, profile, latestPlayers, steamPrice } = row;
  const playerDate = latestPlayers?.capturedAt ?? null;
  const priceDate = priceTimestamp(steamPrice);
  const score = topGameScore({ latestPlayers, steamPrice, game });
  const categories = game ? GameTagNormalizer.categoriesForGame(game) : [];

  return {
    rank,
    gameId: game?.id ?? null,
    steamAppId: entry.steamAppId,
    title: game?.title ?? entry.title,
    coverUrl: game?.coverUrl ?? `https://cdn.akamai.steamstatic.com/steam/apps/${entry.steamAppId}/header.jpg`,
    categories,
    tags: game?.genres ?? [],
    currentPlayers: latestPlayers?.playersOnline ?? null,
    playerFreshness: freshness(playerDate, getTopGamesStalePlayerHours()),
    playerLastUpdatedAt: playerDate?.toISOString() ?? null,
    playerSource: latestPlayers?.source ?? "no-data",
    bestSteamPrice: steamPrice ? priceValue(steamPrice) : null,
    regularSteamPrice: steamPrice ? regularPriceValue(steamPrice) : null,
    discountPercent: steamPrice?.discountPercent ?? 0,
    currency: steamPrice?.currency ?? null,
    priceFreshness: freshness(priceDate, getTopGamesStalePriceHours()),
    priceLastUpdatedAt: priceDate?.toISOString() ?? null,
    sourceName: priceSourceName(steamPrice),
    gameValueScore: score.score,
    scoreExplanation: score.explanation,
    recommendation: score.recommendation,
    noDataReasons: noDataReasons(latestPlayers, steamPrice, game)
  };
}

function topGameScore(input: {
  latestPlayers: PlayerCountSnapshot | null;
  steamPrice: TopSteamPrice | null;
  game: Game | null;
}): { score: number | null; recommendation: TopGameRecommendation; explanation: string[] } {
  const explanation: string[] = [];
  if (!input.game) {
    return { score: null, recommendation: "insufficient-data", explanation: ["Gra nie jest jeszcze zaimportowana do tabeli śledzonych gier."] };
  }
  if (!input.latestPlayers || !input.steamPrice) {
    if (!input.latestPlayers) {
      explanation.push("Brak aktualnych danych o liczbie graczy.");
    }
    if (!input.steamPrice) {
      explanation.push("Brak aktualnej ceny Steam Store.");
    }
    return { score: null, recommendation: "insufficient-data", explanation };
  }

  const players = input.latestPlayers.playersOnline;
  const price = priceValue(input.steamPrice);
  const discount = input.steamPrice.discountPercent ?? 0;
  const freeToPlay = price === 0;
  const playerScore = Math.min(45, Math.log10(players + 1) * 9);
  const priceScore = freeToPlay ? 30 : Math.max(0, 30 - Math.min(30, price / 3));
  const discountScore = Math.min(20, discount / 5);
  const freshnessScore =
    freshness(input.latestPlayers.capturedAt, getTopGamesStalePlayerHours()) === "fresh" &&
    freshness(priceTimestamp(input.steamPrice), getTopGamesStalePriceHours()) === "fresh"
      ? 5
      : 0;
  const score = Math.max(0, Math.min(100, Math.round(playerScore + priceScore + discountScore + freshnessScore)));

  explanation.push(`${players.toLocaleString("pl-PL")} aktualnych graczy Steam.`);
  explanation.push(freeToPlay ? "Cena Steam Store: free-to-play." : `Cena Steam Store: ${price.toFixed(2)} ${input.steamPrice.currency}.`);
  if (discount > 0) {
    explanation.push(`Aktualna zniżka: ${discount}%.`);
  }

  return {
    score,
    recommendation:
      score >= 80
        ? "excellent-value"
        : score >= 65
          ? "good-value"
          : score >= 45
            ? "neutral"
            : discount > 0
              ? "neutral"
              : "wait-for-sale",
    explanation
  };
}

function coverageForItems(items: ApiTopGameItem[]): ApiTopGamesCoverage {
  const noPlayerDataCount = items.filter((item) => item.currentPlayers === null || item.playerSource === "no-data").length;
  const noPriceDataCount = items.filter((item) => item.bestSteamPrice === null).length;
  return {
    topTrackedCount: items.length,
    importedCount: items.filter((item) => item.gameId !== null).length,
    withPlayerCount: items.filter((item) => item.currentPlayers !== null && item.playerSource !== "mock").length,
    withFreshPlayerCount: items.filter((item) => item.playerFreshness === "fresh").length,
    withSteamPrice: items.filter((item) => item.bestSteamPrice !== null).length,
    withFreshSteamPrice: items.filter((item) => item.priceFreshness === "fresh").length,
    freeToPlayCount: items.filter((item) => item.bestSteamPrice === 0).length,
    noPriceCount: noPriceDataCount,
    stalePriceCount: items.filter((item) => item.priceFreshness === "stale").length,
    failedLastRefreshCount: 0,
    fullScoreCount: items.filter((item) => item.gameValueScore !== null && item.recommendation !== "insufficient-data").length,
    insufficientDataCount: items.filter((item) => item.gameValueScore === null || item.recommendation === "insufficient-data").length,
    noPlayerDataCount,
    noPriceDataCount,
    mockPublicDataCount: items.filter((item) => item.playerSource === "mock" || item.noDataReasons.includes("player-count-not-real")).length
  };
}

function sortTopGames(items: ApiTopGameItem[], sort: ApiTopGamesResponse["sort"]): ApiTopGameItem[] {
  return [...items].sort((a, b) => {
    if (sort === "score") {
      return (b.gameValueScore ?? -1) - (a.gameValueScore ?? -1) || (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
    }
    if (sort === "price") {
      return (a.bestSteamPrice ?? Number.MAX_SAFE_INTEGER) - (b.bestSteamPrice ?? Number.MAX_SAFE_INTEGER);
    }
    if (sort === "discount") {
      return b.discountPercent - a.discountPercent || (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
    }
    if (sort === "freshness") {
      return freshnessRank(a) - freshnessRank(b) || (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
    }
    return (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
  });
}

function freshnessRank(item: ApiTopGameItem): number {
  const player = item.playerFreshness === "fresh" ? 0 : item.playerFreshness === "stale" ? 1 : 2;
  const price = item.priceFreshness === "fresh" ? 0 : item.priceFreshness === "stale" ? 1 : 2;
  return player + price;
}

function freshness(date: Date | null, staleHours: number): TopGameFreshness {
  if (!date) {
    return "missing";
  }
  return Date.now() - date.getTime() > staleHours * 60 * 60 * 1000 ? "stale" : "fresh";
}

function priceTimestamp(price: TopSteamPrice | null): Date | null {
  if (!price) {
    return null;
  }
  if ("capturedAt" in price) {
    return price.capturedAt;
  }
  return price.fetchedAt ?? price.updatedAt;
}

function priceValue(price: TopSteamPrice): number {
  return "bestPrice" in price ? price.bestPrice : price.price;
}

function regularPriceValue(price: TopSteamPrice): number | null {
  return "basePrice" in price ? price.basePrice : price.regularPrice;
}

function priceSourceName(price: TopSteamPrice | null): "steam-store" | "manual" | "none" {
  if (!price) {
    return "none";
  }
  if ("source" in price && price.source === "manual") {
    return "manual";
  }
  return "steam-store";
}

function noDataReasons(
  latestPlayers: PlayerCountSnapshot | null,
  steamPrice: TopSteamPrice | null,
  game: Game | null
): string[] {
  const reasons: string[] = [];
  if (!game) {
    reasons.push("not-imported");
  }
  if (!latestPlayers) {
    reasons.push("missing-player-count");
  }
  if (!steamPrice) {
    reasons.push("missing-steam-price");
  }
  if (latestPlayers?.source === "mock") {
    reasons.push("player-count-not-real");
  }
  return reasons;
}

export const topGamesService = new TopGamesService();
