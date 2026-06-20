import {
  getCatalogPriceStaleHours,
  getGGDealsApiKey,
  getPlayerCountStaleMinutes,
  getPriceMode,
  getPriceProvider,
  showGogPublic
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import {
  bestValueScore,
  categoryRankingService,
  toStatsGame,
  type CategoryStatsSource
} from "@/lib/services/category-service";
import { resolveGGDealsStatusFromLogs } from "@/lib/services/ggdeals-diagnostics";
import { publicPlayerSnapshot } from "@/lib/services/public-data-service";
import { topGamesService } from "@/lib/services/top-games-service";
import type { StatsDataMode } from "@/lib/types";
import type { ApiStatsGame, ApiStatsOverview } from "@shared/api-types";

export class StatsService {
  async overview(limit = 8): Promise<ApiStatsOverview> {
    const sources = await categoryRankingService.loadSources();
    const [
      catalogStatus,
      realPlayerSnapshots,
      mockPlayerSnapshots,
      manualPriceSnapshots,
      gogPriceSnapshots,
      steamStorePriceSnapshots,
      ggdealsPriceSnapshots,
      priceApiSnapshots,
      mockPriceSnapshots,
      manualOffers,
      gogOffers,
      steamStoreOffers,
      ggdealsOffers,
      priceApiOffers,
      mockOffers,
      importedGames,
      catalogOfferStatus,
      latestPlayerRefresh,
      latestPriceRefresh,
      integrationLogs
    ] = await Promise.all([
      repositories.steamCatalog.status(),
      repositories.snapshots.countPlayerSnapshotsBySource("steam-api"),
      repositories.snapshots.countPlayerSnapshotsBySource("mock"),
      repositories.snapshots.countPriceSnapshotsBySource("manual"),
      repositories.snapshots.countPriceSnapshotsBySource("gog"),
      repositories.snapshots.countPriceSnapshotsBySource("steam-store"),
      repositories.snapshots.countPriceSnapshotsBySource("ggdeals"),
      repositories.snapshots.countPriceSnapshotsBySource("price-api"),
      repositories.snapshots.countPriceSnapshotsBySource("mock"),
      repositories.games.countOffersBySource("manual"),
      repositories.games.countOffersBySource("gog"),
      repositories.games.countOffersBySource("steam-store"),
      repositories.games.countOffersBySource("ggdeals"),
      repositories.games.countOffersBySource("price-api"),
      repositories.games.countOffersBySource("mock"),
      repositories.games.listImported(500),
      repositories.catalogOffers.status(new Date(Date.now() - getCatalogPriceStaleHours() * 60 * 60 * 1000)),
      repositories.snapshots.latestPlayerRefresh(),
      repositories.snapshots.latestPriceRefresh(),
      repositories.diagnostics.listIntegrationLogs()
    ]);

    const [topGamesCoverage] = await Promise.all([topGamesService.coverage()]);
    const playerStaleBefore = new Date(Date.now() - getPlayerCountStaleMinutes() * 60 * 1000);
    const importedPlayerSnapshots = (
      await Promise.all(importedGames.map((game) => repositories.snapshots.latestPlayersBySteamAppId(game.steamAppId)))
    ).map(publicPlayerSnapshot);
    const gamesWithoutPlayerData = importedPlayerSnapshots.filter((snapshot) => snapshot === null).length;
    const stalePlayerSnapshots = importedPlayerSnapshots.filter(
      (snapshot) => snapshot !== null && snapshot.capturedAt < playerStaleBefore
    ).length;

    const publicGogPriceSnapshots = showGogPublic() ? gogPriceSnapshots : 0;
    const publicGogOffers = showGogPublic() ? gogOffers : 0;
    const realInternalPriceSnapshots = manualPriceSnapshots + publicGogPriceSnapshots + steamStorePriceSnapshots;
    const realPriceSnapshots = realInternalPriceSnapshots + ggdealsPriceSnapshots + priceApiSnapshots;
    const realOffers = manualOffers + publicGogOffers + steamStoreOffers + ggdealsOffers + priceApiOffers;
    const gamesWithoutPrices = sources.filter((source) => !source.profile.latestPrice && !source.profile.bestOffer).length;
    const ggdealsRuntime = resolveGGDealsStatusFromLogs({
      hasApiKey: Boolean(getGGDealsApiKey()),
      logs: integrationLogs,
      realOffers,
      realPriceSnapshots
    });

    const byPlayers = [...sources].sort((a, b) => toStatsGame(b).currentPlayers - toStatsGame(a).currentPlayers);
    const byTrend = [...sources].sort((a, b) => b.trendPercent - a.trendPercent);
    const byDrop = [...sources].sort((a, b) => a.trendPercent - b.trendPercent);
    const sourcesWithTrackedPrices = sources.filter(hasTrackedPrice);
    const byBestValue = [...sourcesWithTrackedPrices].sort((a, b) => bestValueScore(b) - bestValueScore(a));
    const byWatchlists = [...sources].sort((a, b) => b.watchlistCount - a.watchlistCount);
    const freeToPlay = [...sourcesWithTrackedPrices]
      .filter((source) => toStatsGame(source).bestPrice === 0)
      .sort((a, b) => toStatsGame(b).currentPlayers - toStatsGame(a).currentPlayers);
    const trackedDeals = [...sourcesWithTrackedPrices].sort((a, b) => bestValueScore(b) - bestValueScore(a));
    const hiddenGems = [...sources]
      .filter((source) => toStatsGame(source).currentPlayers <= 40000 && source.profile.score.score >= 70)
      .sort((a, b) => bestValueScore(b) - bestValueScore(a));
    const categories = categoryRankingService.buildFromSources(sources, limit).categories;

    return {
      topPlayers: byPlayers.slice(0, limit).map(toStatsGame),
      trending: byTrend.slice(0, limit).map(toStatsGame),
      trendingUp: byTrend.filter((source) => source.trendPercent > 0).slice(0, limit).map(toStatsGame),
      trendingDown: byDrop.filter((source) => source.trendPercent < 0).slice(0, limit).map(toStatsGame),
      biggestGrowth: byTrend.slice(0, limit).map(toStatsGame),
      biggestDrop: byDrop.slice(0, limit).map(toStatsGame),
      bestValue: byBestValue.slice(0, limit).map(toStatsGame),
      freeToPlay: freeToPlay.slice(0, limit).map(toStatsGame),
      trackedDeals: trackedDeals.slice(0, limit).map(toStatsGame),
      popularWatchlists: byWatchlists.slice(0, limit).map(toStatsGame),
      hiddenGems: hiddenGems.slice(0, limit).map(toStatsGame),
      categories,
      dataFreshness: {
        latestSteamCatalogSync: catalogStatus.lastSyncedAt?.toISOString() ?? null,
        latestPlayerCountRefresh: latestPlayerRefresh?.toISOString() ?? null,
        latestPriceRefresh: latestPriceRefresh?.toISOString() ?? null
      },
      sourceCounts: {
        importedGames: importedGames.length,
        steamCatalogEntries: catalogStatus.entryCount,
        realInternalPriceSnapshots,
        realPriceSnapshots,
        mockPriceSnapshots,
        realOffers,
        mockOffers,
        realPlayerSnapshots,
        mockPlayerSnapshots,
        gogOffers: publicGogOffers,
        steamStoreOffers,
        catalogStoreOffers: catalogOfferStatus.catalogStoreOfferCount,
        manualOffers,
        gamesWithoutPrices,
        stalePlayerSnapshots,
        gamesWithoutPlayerData
      },
      topGamesCoverage,
      missingDataHints: buildMissingDataHints({
        catalogEntries: catalogStatus.entryCount,
        importedGames: importedGames.length,
        gamesWithoutPrices,
        gamesWithoutPlayerData,
        stalePlayerSnapshots,
        gogOffers,
        steamStoreOffers,
        catalogStoreOffers: catalogOfferStatus.catalogStoreOfferCount,
        mockPriceSnapshots
      }),
      updatedAt: new Date().toISOString(),
      mode: resolveStatsMode({ mockPlayerSnapshots, mockPriceSnapshots, realPlayerSnapshots, realPriceSnapshots }),
      ggdealsStatus: ggdealsRuntime.status,
      priceProvider: getPriceProvider(),
      priceMode: getPriceMode()
    };
  }
}

function resolveStatsMode({
  mockPlayerSnapshots,
  mockPriceSnapshots,
  realPlayerSnapshots,
  realPriceSnapshots
}: {
  mockPlayerSnapshots: number;
  mockPriceSnapshots: number;
  realPlayerSnapshots: number;
  realPriceSnapshots: number;
}): StatsDataMode {
  if (realPlayerSnapshots > 0 && realPriceSnapshots > 0 && mockPlayerSnapshots === 0 && mockPriceSnapshots === 0) {
    return "real";
  }
  if (realPlayerSnapshots > 0 || realPriceSnapshots > 0) {
    return "mixed";
  }
  return "mock";
}

function buildMissingDataHints({
  catalogEntries,
  importedGames,
  gamesWithoutPrices,
  gamesWithoutPlayerData,
  stalePlayerSnapshots,
  gogOffers,
  steamStoreOffers,
  catalogStoreOffers,
  mockPriceSnapshots
}: {
  catalogEntries: number;
  importedGames: number;
  gamesWithoutPrices: number;
  gamesWithoutPlayerData: number;
  stalePlayerSnapshots: number;
  gogOffers: number;
  steamStoreOffers: number;
  catalogStoreOffers: number;
  mockPriceSnapshots: number;
}): string[] {
  const hints: string[] = [];

  if (catalogEntries < 5000) {
    hints.push("Lista gier Steam jest częściowa. Synchronizuj kolejne pakiety katalogu w panelu admina.");
  }

  if (importedGames < 20) {
    hints.push("Tabela Game zawiera tylko gry śledzone. Importuj wybrane gry z katalogu Steam zamiast całego katalogu.");
  }

  if (gamesWithoutPrices > 0) {
    hints.push("Część gier nie ma zaufanej ceny. Dodaj cenę manualną, GOG mapping albo Steam Store refresh.");
  }

  if (gamesWithoutPlayerData > 0) {
    hints.push("Część importowanych gier nie ma jeszcze realnego snapshotu graczy ze Steam.");
  }

  if (stalePlayerSnapshots > 0) {
    hints.push("Część snapshotów graczy jest starsza niż ustawiony próg świeżości.");
  }

  if (gogOffers === 0) {
    hints.push("GOG jest skonfigurowany, ale nie ma jeszcze widocznych ofert po mapowaniu.");
  }

  if (steamStoreOffers === 0) {
    hints.push("Steam Store connector jest eksperymentalny i wymaga testowego refreshu 1-2 gier.");
  }

  if (catalogStoreOffers === 0) {
    hints.push("Katalog Steam nie ma jeszcze zapisanych cen backfill; użyj małego dry run przed realnym backfillem.");
  }

  if (mockPriceSnapshots > 0) {
    hints.push("W bazie są jeszcze demonstracyjne ceny. Uruchom cleanup dopiero po bezpiecznym preview.");
  }

  return hints;
}

export function topStatsGame(games: ApiStatsGame[]): ApiStatsGame | null {
  return games[0] ?? null;
}

function hasTrackedPrice(source: CategoryStatsSource): boolean {
  return toStatsGame(source).bestPrice !== null;
}

export const statsService = new StatsService();
