import { repositories } from "@/lib/repositories";
import type { GameProfile } from "@/lib/types";
import type { ApiStatsCategory, ApiStatsGame, ApiStatsOverview } from "@shared/api-types";

type StatsSource = {
  profile: GameProfile;
  trendPercent: number;
};

export class StatsService {
  async overview(limit = 8): Promise<ApiStatsOverview> {
    const games = await repositories.games.list();
    const profiles = (
      await Promise.all(games.map((game) => repositories.games.getProfile(game.id)))
    ).filter((profile): profile is GameProfile => profile !== null);
    const watchlist = await repositories.watchlist.list();
    const [catalogStatus, realPlayerSnapshots, mockPlayerSnapshots, importedGames, latestPlayerRefresh] = await Promise.all([
      repositories.steamCatalog.status(),
      repositories.snapshots.countPlayerSnapshotsBySource("steam-api"),
      repositories.snapshots.countPlayerSnapshotsBySource("mock"),
      repositories.games.listImported(500),
      repositories.snapshots.latestPlayerRefresh()
    ]);
    const watchlistCounts = new Map<string, number>();

    for (const item of watchlist) {
      watchlistCounts.set(item.gameId, (watchlistCounts.get(item.gameId) ?? 0) + 1);
    }

    const sources = profiles.map((profile) => ({
      profile,
      trendPercent: calculateTrendPercent(profile)
    }));
    const byPlayers = [...sources].sort((a, b) => statsGame(b).currentPlayers - statsGame(a).currentPlayers);
    const byTrend = [...sources].sort((a, b) => b.trendPercent - a.trendPercent);
    const byDrop = [...sources].sort((a, b) => a.trendPercent - b.trendPercent);
    const byBestValue = [...sources].sort((a, b) => bestValueScore(b) - bestValueScore(a));
    const byWatchlists = [...sources].sort(
      (a, b) => (watchlistCounts.get(b.profile.game.id) ?? 0) - (watchlistCounts.get(a.profile.game.id) ?? 0)
    );
    const hiddenGems = [...sources]
      .filter((source) => statsGame(source).currentPlayers <= 40000 && source.profile.score.score >= 70)
      .sort((a, b) => bestValueScore(b) - bestValueScore(a));

    return {
      topPlayers: byPlayers.slice(0, limit).map(statsGame),
      trending: byTrend.slice(0, limit).map(statsGame),
      biggestGrowth: byTrend.slice(0, limit).map(statsGame),
      biggestDrop: byDrop.slice(0, limit).map(statsGame),
      bestValue: byBestValue.slice(0, limit).map(statsGame),
      popularWatchlists: byWatchlists.slice(0, limit).map(statsGame),
      hiddenGems: hiddenGems.slice(0, limit).map(statsGame),
      categories: buildCategories(sources),
      dataFreshness: {
        latestSteamCatalogSync: catalogStatus.lastSyncedAt?.toISOString() ?? null,
        latestPlayerCountRefresh: latestPlayerRefresh?.toISOString() ?? null
      },
      sourceCounts: {
        importedGames: importedGames.length,
        steamCatalogEntries: catalogStatus.entryCount,
        realPlayerSnapshots,
        mockPlayerSnapshots
      },
      updatedAt: new Date().toISOString(),
      mode: resolveStatsMode(realPlayerSnapshots, mockPlayerSnapshots)
    };
  }
}

function resolveStatsMode(realPlayerSnapshots: number, mockPlayerSnapshots: number): "real" | "mixed" | "mock" {
  if (realPlayerSnapshots > 0 && mockPlayerSnapshots === 0) {
    return "real";
  }
  if (realPlayerSnapshots > 0 && mockPlayerSnapshots > 0) {
    return "mixed";
  }
  return "mock";
}

function buildCategories(sources: StatsSource[]): ApiStatsCategory[] {
  return [
    category("top-current-players", "Top by current players", "Najwieksza aktywnosc graczy teraz.", sources, () => true, [
      "players"
    ]),
    category("trending-now", "Trending now", "Najmocniejszy wzrost aktywnosci.", sources, () => true, ["trend"]),
    category("biggest-growth", "Biggest player growth", "Gry z najwyzszym dodatnim trendem.", sources, () => true, [
      "trend"
    ]),
    category("biggest-drop", "Biggest player drop", "Gry, ktore traca aktywnosc graczy.", sources, () => true, ["drop"]),
    category("best-value", "Best value", "Niska cena, wysoka aktywnosc i dobry score.", sources, () => true, ["value"]),
    category("popular-watchlists", "Popular on watchlists", "Tytuly czesto dodawane do obserwowanych.", sources, () => true, [
      "score"
    ]),
    category("hidden-gems", "Hidden gems", "Mniejsze gry z mocnym stosunkiem wartosci do ceny.", sources, (source) => {
      const game = statsGame(source);
      return game.currentPlayers <= 40000 && game.gameValueScore >= 70;
    }, ["value"]),
    category("multiplayer-coop", "Multiplayer/Co-op leaders", "Najaktywniejsze gry do wspolnej gry.", sources, (source) =>
      hasAnyTag(source, ["Multiplayer", "Co-op", "Team-Based"])
    ),
    category("rpg", "RPG leaders", "Najmocniejsze RPG i action RPG.", sources, (source) =>
      hasAnyTag(source, ["RPG", "Action RPG"])
    ),
    category("indie", "Indie leaders", "Najciekawsze gry indie wedlug aktywnosci i score.", sources, (source) =>
      hasAnyTag(source, ["Indie"])
    ),
    category("strategy", "Strategy leaders", "Strategie, symulacje i grand strategy.", sources, (source) =>
      hasAnyTag(source, ["Strategy", "Grand Strategy", "4X", "Simulation"])
    )
  ];
}

function category(
  id: string,
  title: string,
  description: string,
  sources: StatsSource[],
  predicate: (source: StatsSource) => boolean,
  sortModes: Array<"players" | "trend" | "drop" | "value" | "score"> = ["players"]
): ApiStatsCategory {
  const sorted = sources.filter(predicate).sort((a, b) => compareSources(a, b, sortModes));
  return {
    id,
    title,
    description,
    games: sorted.slice(0, 8).map(statsGame)
  };
}

function compareSources(a: StatsSource, b: StatsSource, sortModes: Array<"players" | "trend" | "drop" | "value" | "score">): number {
  for (const mode of sortModes) {
    const diff =
      mode === "players"
        ? statsGame(b).currentPlayers - statsGame(a).currentPlayers
        : mode === "trend"
          ? b.trendPercent - a.trendPercent
          : mode === "drop"
            ? a.trendPercent - b.trendPercent
            : mode === "value"
              ? bestValueScore(b) - bestValueScore(a)
              : b.profile.score.score - a.profile.score.score;
    if (diff !== 0) {
      return diff;
    }
  }
  return b.profile.score.score - a.profile.score.score;
}

function hasAnyTag(source: StatsSource, tags: string[]): boolean {
  const normalized = source.profile.game.genres.map((tag) => tag.toLowerCase());
  return tags.some((tag) => normalized.includes(tag.toLowerCase()));
}

function statsGame(source: StatsSource): ApiStatsGame {
  const { profile, trendPercent } = source;
  const price = profile.latestPrice?.price ?? profile.bestOffer?.price ?? 0;

  return {
    id: profile.game.id,
    steamAppId: profile.game.steamAppId,
    title: profile.game.title,
    coverUrl: profile.game.coverUrl,
    currentPlayers: profile.latestPlayers?.playersOnline ?? 0,
    playerTrendPercent: trendPercent,
    currentPrice: price,
    historicalLow: profile.latestPrice?.historicalLow ?? profile.historicalLow ?? price,
    discountPercent: profile.latestPrice?.discountPercent ?? profile.bestOffer?.discountPercent ?? 0,
    gameValueScore: profile.score.score,
    recommendation: profile.score.recommendation,
    playerSource: profile.latestPlayers?.source ?? "mock",
    tags: profile.game.genres
  };
}

function bestValueScore(source: StatsSource): number {
  const game = statsGame(source);
  const pricePenalty = game.currentPrice === 0 ? 0 : Math.min(35, game.currentPrice / 8);
  const playerBoost = Math.min(30, Math.log10(game.currentPlayers + 1) * 6);
  const discountBoost = Math.min(20, game.discountPercent / 4);
  return game.gameValueScore + playerBoost + discountBoost - pricePenalty;
}

function calculateTrendPercent(summary: GameProfile): number {
  const latest = summary.playerHistory.at(-1);
  const previous = summary.playerHistory.at(-2);

  if (!latest || !previous || previous.playersOnline <= 0) {
    return 0;
  }

  return Math.round(((latest.playersOnline - previous.playersOnline) / previous.playersOnline) * 1000) / 10;
}

export const statsService = new StatsService();
