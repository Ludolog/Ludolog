import {
  getTopGamesStalePlayerHours,
  getTopGamesStalePriceHours
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { gameSearchService } from "@/lib/services/game-search-service";
import { GameTagNormalizer } from "@/lib/services/category-service";
import { steamApiService } from "@/lib/services/steam-api-service";
import { steamStorePriceService } from "@/lib/services/steam-store-price-service";
import { curatedTopTrackedGames } from "@/lib/top-games-seed";
import type { CatalogStoreOffer, Game, GamePriceSnapshot, GameProfile, PlayerCountSnapshot, StoreOffer, TopTrackedGame } from "@/lib/types";
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
    const entries = await this.resolveTopEntries(limit, dryRun);
    const response: ApiTopGamesImportResponse = {
      dryRun,
      requested: entries.length,
      imported: 0,
      alreadyExisting: 0,
      missingFromSteamCatalog: 0,
      failed: 0,
      errors: [],
      results: []
    };

    for (const entry of entries) {
      try {
        const existing = await repositories.games.findBySteamAppId(entry.steamAppId);
        if (existing) {
          if (!dryRun) {
            await repositories.topTrackedGames.linkGame(entry.steamAppId, existing.id);
          }
          response.alreadyExisting += 1;
          response.results.push({
            steamAppId: entry.steamAppId,
            title: entry.title,
            gameId: existing.id,
            imported: false,
            alreadyExisting: true,
            missingFromSteamCatalog: false,
            message: "Game already exists in tracked Game table."
          });
          continue;
        }

        const catalogEntry = await repositories.steamCatalog.findBySteamAppId(entry.steamAppId);
        if (!catalogEntry || !catalogEntry.isGame || !catalogEntry.isActive) {
          response.missingFromSteamCatalog += 1;
          response.results.push({
            steamAppId: entry.steamAppId,
            title: entry.title,
            gameId: null,
            imported: false,
            alreadyExisting: false,
            missingFromSteamCatalog: true,
            message: "Top game is not present in local SteamCatalogEntry yet."
          });
          continue;
        }

        if (dryRun) {
          response.results.push({
            steamAppId: entry.steamAppId,
            title: catalogEntry.title,
            gameId: null,
            imported: false,
            alreadyExisting: false,
            missingFromSteamCatalog: false,
            message: "Dry run only; this game would be imported from SteamCatalogEntry."
          });
          continue;
        }

        const imported = await gameSearchService.importGame({ steamAppId: entry.steamAppId }, { refreshPlayers: false });
        await repositories.topTrackedGames.linkGame(entry.steamAppId, imported.gameId);
        response.imported += imported.created ? 1 : 0;
        response.alreadyExisting += imported.created ? 0 : 1;
        response.results.push({
          steamAppId: entry.steamAppId,
          title: imported.summary.game.title,
          gameId: imported.gameId,
          imported: imported.created,
          alreadyExisting: !imported.created,
          missingFromSteamCatalog: false,
          message: imported.created ? "Imported into Game." : "Game already existed."
        });
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
          missingFromSteamCatalog: false,
          message
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "search",
      level: response.failed > 0 ? "warning" : "info",
      message: `TOP 100 import finished. dryRun=${dryRun}, requested=${response.requested}, imported=${response.imported}, alreadyExisting=${response.alreadyExisting}, missingFromSteamCatalog=${response.missingFromSteamCatalog}, failed=${response.failed}.`
    });

    return response;
  }

  async refreshPlayers(input: { limit?: number; dryRun?: boolean }): Promise<ApiTopGamesRefreshPlayersResponse> {
    const dryRun = input.dryRun ?? true;
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
    const entries = await this.resolveTopEntries(limit, dryRun);
    const response: ApiTopGamesRefreshPlayersResponse = {
      dryRun,
      requested: entries.length,
      refreshed: 0,
      skippedFreshCache: 0,
      failed: 0,
      createdSnapshots: 0,
      errors: [],
      results: []
    };
    const staleBefore = new Date(Date.now() - getTopGamesStalePlayerHours() * 60 * 60 * 1000);

    for (const entry of entries) {
      const game = await this.findTopGame(entry);
      if (!game) {
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

      const latest = await repositories.snapshots.latestPlayersBySteamAppId(entry.steamAppId);
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
          response.failed += 1;
          response.errors.push({ steamAppId: entry.steamAppId, gameId: game.id, message: "No player snapshot was stored." });
          response.results.push({
            steamAppId: entry.steamAppId,
            gameId: game.id,
            refreshed: false,
            skipped: false,
            playersOnline: null,
            snapshotId: null,
            message: "No player snapshot was stored."
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
      message: `TOP 100 player refresh finished. dryRun=${dryRun}, requested=${response.requested}, refreshed=${response.refreshed}, skippedFreshCache=${response.skippedFreshCache}, failed=${response.failed}.`
    });

    return response;
  }

  async refreshPrices(input: { limit?: number; dryRun?: boolean }): Promise<ApiTopGamesRefreshPricesResponse> {
    const dryRun = input.dryRun ?? true;
    const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 100)));
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
        const profile = game ? await repositories.games.getProfile(game.id) : null;
        const latestPlayers = await repositories.snapshots.latestPlayersBySteamAppId(entry.steamAppId);
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
    noDataReasons: noDataReasons(latestPlayers, steamPrice, game, profile)
  };
}

function topGameScore(input: {
  latestPlayers: PlayerCountSnapshot | null;
  steamPrice: TopSteamPrice | null;
  game: Game | null;
}): { score: number | null; recommendation: TopGameRecommendation; explanation: string[] } {
  const explanation: string[] = [];
  if (!input.game) {
    return { score: null, recommendation: "insufficient-data", explanation: ["Game is not imported into the tracked table yet."] };
  }
  if (!input.latestPlayers || !input.steamPrice) {
    if (!input.latestPlayers) {
      explanation.push("Missing Steam player count.");
    }
    if (!input.steamPrice) {
      explanation.push("Missing Steam Store price.");
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

  explanation.push(`${players.toLocaleString("en-US")} current Steam players.`);
  explanation.push(freeToPlay ? "Free-to-play Steam Store price." : `Steam Store price ${price.toFixed(2)} ${input.steamPrice.currency}.`);
  if (discount > 0) {
    explanation.push(`${discount}% current discount.`);
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
  return {
    topTrackedCount: items.length,
    importedCount: items.filter((item) => item.gameId !== null).length,
    withPlayerCount: items.filter((item) => item.currentPlayers !== null).length,
    withFreshPlayerCount: items.filter((item) => item.playerFreshness === "fresh").length,
    withSteamPrice: items.filter((item) => item.bestSteamPrice !== null).length,
    withFreshSteamPrice: items.filter((item) => item.priceFreshness === "fresh").length,
    freeToPlayCount: items.filter((item) => item.bestSteamPrice === 0).length,
    noPriceCount: items.filter((item) => item.bestSteamPrice === null).length,
    stalePriceCount: items.filter((item) => item.priceFreshness === "stale").length,
    failedLastRefreshCount: 0
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
    return "no-data";
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
  game: Game | null,
  profile: GameProfile | null
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
  if (profile && profile.latestPlayers?.source === "mock") {
    reasons.push("player-count-not-real");
  }
  return reasons;
}

export const topGamesService = new TopGamesService();
