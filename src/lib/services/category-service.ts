import { repositories } from "@/lib/repositories";
import { publicGameProfile } from "@/lib/services/public-data-service";
import type { Game, GameProfile, StoreOffer } from "@/lib/types";
import type {
  ApiCategoriesOverview,
  ApiCategoryDetails,
  ApiCategorySummary,
  ApiCategoryType,
  ApiPriceDataSource,
  ApiStatsGame
} from "@shared/api-types";

export type CategoryStatsSource = {
  profile: GameProfile;
  trendPercent: number;
  watchlistCount: number;
};

type CategoryDefinition = {
  slug: string;
  title: string;
  description: string;
  type: ApiCategoryType;
  predicate: (source: CategoryStatsSource) => boolean;
  sortModes?: SortMode[];
};

type SortMode = "players" | "trend" | "drop" | "value" | "watchlist" | "title";

const genreCategoryDefinitions = [
  ["action", "Action", "Szybkie gry akcji i dynamiczne produkcje."],
  ["rpg", "RPG", "RPG, action RPG i gry z rozwojem postaci."],
  ["strategy", "Strategy", "Strategie, taktyka, 4X i grand strategy."],
  ["simulation", "Simulation", "Symulatory, sandboxy i gry systemowe."],
  ["indie", "Indie", "Najciekawsze gry niezależne."],
  ["multiplayer", "Multiplayer", "Gry wieloosobowe i aktywne społeczności."],
  ["co-op", "Co-op", "Gry do wspólnej rozgrywki."],
  ["survival", "Survival", "Survival, crafting i przetrwanie."],
  ["shooter", "Shooter", "Strzelanki i gry nastawione na celność."],
  ["sports-racing", "Sports/Racing", "Sport, wyścigi i rywalizacja zręcznościowa."],
  ["management", "Management", "Zarządzanie, ekonomia i planowanie."],
  ["sandbox", "Sandbox", "Otwarte systemy, budowanie i swoboda gry."],
  ["horror", "Horror", "Horror, napięcie i mroczne klimaty."],
  ["adventure", "Adventure", "Przygody, eksploracja i opowieści."]
] as const;

const manualCategoryMap: Record<number, string[]> = {
  440: ["action", "shooter", "multiplayer"],
  570: ["strategy", "multiplayer", "action"],
  730: ["shooter", "multiplayer", "action"],
  1250: ["action", "shooter", "co-op", "horror"],
  252490: ["survival", "multiplayer", "sandbox"],
  275850: ["adventure", "simulation", "sandbox"],
  292030: ["rpg", "adventure", "action"],
  381210: ["horror", "multiplayer", "survival"],
  413150: ["indie", "simulation", "rpg"],
  578080: ["shooter", "multiplayer", "survival"],
  892970: ["survival", "co-op", "sandbox", "indie"],
  105600: ["sandbox", "adventure", "indie"],
  1085660: ["shooter", "multiplayer", "action"],
  108600: ["survival", "simulation", "indie"],
  1086940: ["rpg", "co-op", "adventure"],
  1091500: ["rpg", "action", "adventure"],
  1172470: ["shooter", "multiplayer", "action"],
  1245620: ["rpg", "action", "adventure"],
  227300: ["simulation"],
  230410: ["action", "shooter", "multiplayer"],
  238960: ["rpg", "action", "multiplayer"]
};

const tagAliases: Array<[RegExp, string]> = [
  [/action|hack and slash|arcade/i, "action"],
  [/rpg|role-playing|souls-like|action rpg/i, "rpg"],
  [/strategy|tactical|4x|grand strategy|rts|turn-based/i, "strategy"],
  [/simulation|simulator|sim/i, "simulation"],
  [/indie/i, "indie"],
  [/multiplayer|mmo|massively multiplayer|pvp|competitive|esports/i, "multiplayer"],
  [/co.?op|cooperative|team-based/i, "co-op"],
  [/survival|crafting/i, "survival"],
  [/shooter|fps|third-person shooter|battle royale/i, "shooter"],
  [/sports|racing|driving|football|soccer/i, "sports-racing"],
  [/management|city builder|automation|economy|tycoon/i, "management"],
  [/sandbox|open world|building/i, "sandbox"],
  [/horror|zombies|survival horror/i, "horror"],
  [/adventure|story rich|exploration|platformer/i, "adventure"]
];

export class GameTagNormalizer {
  static categoriesForGame(game: Game): string[] {
    const categories = new Set<string>(manualCategoryMap[game.steamAppId] ?? []);

    for (const tag of game.genres) {
      for (const [pattern, slug] of tagAliases) {
        if (pattern.test(tag)) {
          categories.add(slug);
        }
      }
    }

    if (categories.size === 0 && game.source === "steam-api") {
      categories.add("uncategorized");
    }

    return [...categories].sort();
  }
}

export class CategoryRankingService {
  async overview(limit = 8): Promise<ApiCategoriesOverview> {
    const sources = await this.loadSources();
    const categories = this.buildFromSources(sources, limit).categories.map(toCategorySummary);
    return {
      categories,
      updatedAt: new Date().toISOString()
    };
  }

  async details(slug: string, limit = 50): Promise<ApiCategoryDetails | null> {
    const sources = await this.loadSources();
    const category = this.buildFromSources(sources, limit).categories.find((item) => item.slug === slug);
    return category ?? null;
  }

  buildFromSources(sources: CategoryStatsSource[], limit = 8): { categories: ApiCategoryDetails[] } {
    const definitions = buildDefinitions();
    const updatedAt = new Date().toISOString();
    const categories = definitions.map((definition) => {
      const games = sources
        .filter(definition.predicate)
        .sort((a, b) => compareSources(a, b, definition.sortModes ?? ["players"]))
        .map(toStatsGame);
      return {
        id: definition.slug,
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        type: definition.type,
        gameCount: games.length,
        topGames: games.slice(0, limit),
        games: games.slice(0, limit),
        updatedAt
      };
    });

    return { categories };
  }

  async loadSources(): Promise<CategoryStatsSource[]> {
    const [games, watchlist] = await Promise.all([repositories.games.list(), repositories.watchlist.list()]);
    const watchlistCounts = new Map<string, number>();

    for (const item of watchlist) {
      watchlistCounts.set(item.gameId, (watchlistCounts.get(item.gameId) ?? 0) + 1);
    }

    const profiles = (
      await Promise.all(games.map((game) => repositories.games.getProfile(game.id)))
    )
      .filter((profile): profile is GameProfile => profile !== null)
      .map(publicGameProfile);

    return profiles.map((profile) => ({
      profile,
      trendPercent: calculateTrendPercent(profile),
      watchlistCount: watchlistCounts.get(profile.game.id) ?? 0
    }));
  }
}

function buildDefinitions(): CategoryDefinition[] {
  const genreDefinitions: CategoryDefinition[] = genreCategoryDefinitions.map(([slug, title, description]) => ({
    slug,
    title,
    description,
    type: "genre",
    predicate: (source) => GameTagNormalizer.categoriesForGame(source.profile.game).includes(slug),
    sortModes: ["players", "value"]
  }));

  return [
    {
      slug: "popularne-teraz",
      title: "Popularne teraz",
      description: "Gry z największą aktywnością graczy w aktualnych snapshotach.",
      type: "trend",
      predicate: () => true,
      sortModes: ["players"]
    },
    {
      slug: "najwiekszy-wzrost-graczy",
      title: "Największy wzrost graczy",
      description: "Tytuły, które najszybciej zyskują aktywność.",
      type: "trend",
      predicate: (source) => source.trendPercent > 0,
      sortModes: ["trend"]
    },
    {
      slug: "najwiekszy-spadek-graczy",
      title: "Największy spadek graczy",
      description: "Gry z największym spadkiem aktywności.",
      type: "trend",
      predicate: (source) => source.trendPercent < 0,
      sortModes: ["drop"]
    },
    {
      slug: "najlepsza-wartosc",
      title: "Najlepsza wartość",
      description: "Najlepszy stosunek ceny, aktywności graczy i GameValue Score.",
      type: "price",
      predicate: (source) => hasTrustedPrice(source),
      sortModes: ["value"]
    },
    {
      slug: "darmowe-gry",
      title: "Darmowe gry",
      description: "Gry z potwierdzoną ceną 0 PLN z realnego lub wewnętrznego źródła.",
      type: "price",
      predicate: (source) => bestKnownPrice(source) === 0,
      sortModes: ["players"]
    },
    {
      slug: "gry-premium",
      title: "Gry premium",
      description: "Płatne gry z realną lub wewnętrzną ceną.",
      type: "price",
      predicate: (source) => (bestKnownPrice(source) ?? 0) > 0,
      sortModes: ["value"]
    },
    {
      slug: "ceny-sledzone",
      title: "Ceny śledzone",
      description: "Gry z cenami z manualnego, GOG albo Steam Store źródła.",
      type: "price",
      predicate: hasTrustedPrice,
      sortModes: ["value"]
    },
    {
      slug: "brak-danych-cenowych",
      title: "Brak danych cenowych",
      description: "Gry bez zaufanej ceny, które wymagają mapowania lub importu ceny.",
      type: "system",
      predicate: (source) => !hasTrustedPrice(source),
      sortModes: ["players"]
    },
    {
      slug: "real-player-data",
      title: "Real player data",
      description: "Gry z rzeczywistymi snapshotami graczy ze Steam.",
      type: "data-source",
      predicate: (source) => source.profile.latestPlayers?.source === "steam-api",
      sortModes: ["players"]
    },
    {
      slug: "mixed-data",
      title: "Dane mieszane",
      description: "Gry z częścią danych rzeczywistych i częścią brakujących lub demonstracyjnych.",
      type: "data-source",
      predicate: (source) => source.profile.latestPlayers?.source === "steam-api" && !hasTrustedPrice(source),
      sortModes: ["players"]
    },
    {
      slug: "demo-mock-data",
      title: "Dane demonstracyjne",
      description: "Gry, które nadal mają wyłącznie demonstracyjne dane cenowe lub graczy.",
      type: "data-source",
      predicate: (source) => !source.profile.latestPlayers || !hasTrustedPrice(source),
      sortModes: ["players"]
    },
    {
      slug: "uncategorized",
      title: "Uncategorized",
      description: "Gry bez wystarczających tagów do klasyfikacji gatunkowej.",
      type: "system",
      predicate: (source) => GameTagNormalizer.categoriesForGame(source.profile.game).includes("uncategorized"),
      sortModes: ["title"]
    },
    ...genreDefinitions
  ];
}

export function toStatsGame(source: CategoryStatsSource): ApiStatsGame {
  const { profile, trendPercent } = source;
  const sourceOffer = pickSourceOffer(profile.offers, profile.bestOffer);
  const priceSnapshot = profile.latestPrice;
  const price = priceSnapshot?.price ?? sourceOffer?.price ?? null;
  const priceSource = (priceSnapshot?.source ?? sourceOffer?.source ?? "none") as ApiPriceDataSource;
  const priceSourceConfidence =
    priceSnapshot?.sourceConfidence ??
    sourceOffer?.sourceConfidence ??
    (price === null ? "no-price-data" : "internal-mock");
  const sourceDate = priceSnapshot?.capturedAt ?? sourceOffer?.fetchedAt ?? sourceOffer?.updatedAt ?? null;

  return {
    id: profile.game.id,
    steamAppId: profile.game.steamAppId,
    title: profile.game.title,
    coverUrl: profile.game.coverUrl,
    currentPlayers: profile.latestPlayers?.playersOnline ?? 0,
    playerTrendPercent: trendPercent,
    currentPrice: price ?? 0,
    bestPrice: price,
    historicalLow: priceSnapshot?.historicalLow ?? profile.historicalLow ?? price ?? 0,
    discountPercent: priceSnapshot?.discountPercent ?? sourceOffer?.discountPercent ?? 0,
    gameValueScore: profile.score.score,
    recommendation: profile.score.recommendation,
    playerSource: profile.latestPlayers?.source ?? "no-data",
    priceSource,
    priceSourceConfidence,
    priceConfidence: priceSourceConfidence,
    priceExternalUrl: priceSnapshot?.externalUrl ?? sourceOffer?.externalUrl ?? sourceOffer?.url ?? null,
    storeName: priceSnapshot?.storeName ?? sourceOffer?.storeName ?? null,
    freshness: resolveFreshness(sourceDate),
    categories: GameTagNormalizer.categoriesForGame(profile.game),
    tags: profile.game.genres
  };
}

export function calculateTrendPercent(summary: GameProfile): number {
  const latest = summary.playerHistory.at(-1);
  const previous = summary.playerHistory.at(-2);

  if (!latest || !previous || previous.playersOnline <= 0) {
    return 0;
  }

  return Math.round(((latest.playersOnline - previous.playersOnline) / previous.playersOnline) * 1000) / 10;
}

export function bestValueScore(source: CategoryStatsSource): number {
  const game = toStatsGame(source);
  const pricePenalty = game.bestPrice === null || game.bestPrice === 0 ? 0 : Math.min(35, game.bestPrice / 8);
  const playerBoost = Math.min(30, Math.log10(game.currentPlayers + 1) * 6);
  const discountBoost = Math.min(20, game.discountPercent / 4);
  return game.gameValueScore + playerBoost + discountBoost - pricePenalty;
}

function compareSources(a: CategoryStatsSource, b: CategoryStatsSource, sortModes: SortMode[]): number {
  for (const mode of sortModes) {
    const diff =
      mode === "players"
        ? toStatsGame(b).currentPlayers - toStatsGame(a).currentPlayers
        : mode === "trend"
          ? b.trendPercent - a.trendPercent
          : mode === "drop"
            ? a.trendPercent - b.trendPercent
            : mode === "value"
              ? bestValueScore(b) - bestValueScore(a)
              : mode === "watchlist"
                ? b.watchlistCount - a.watchlistCount
                : a.profile.game.title.localeCompare(b.profile.game.title);

    if (diff !== 0) {
      return diff;
    }
  }

  return b.profile.score.score - a.profile.score.score;
}

function bestKnownPrice(source: CategoryStatsSource): number | null {
  return source.profile.latestPrice?.price ?? source.profile.bestOffer?.price ?? null;
}

function hasTrustedPrice(source: CategoryStatsSource): boolean {
  return bestKnownPrice(source) !== null;
}

function pickSourceOffer(offers: StoreOffer[], bestOffer: StoreOffer | null): StoreOffer | null {
  if (bestOffer) {
    return bestOffer;
  }
  return offers.find((offer) => offer.source !== "mock" && offer.available) ?? null;
}

function resolveFreshness(date: Date | null): "fresh" | "stale" | "missing" {
  if (!date) {
    return "missing";
  }

  const ageMs = Date.now() - date.getTime();
  return ageMs <= 7 * 24 * 60 * 60 * 1000 ? "fresh" : "stale";
}

function toCategorySummary(category: ApiCategoryDetails): ApiCategorySummary {
  return {
    id: category.id,
    slug: category.slug,
    title: category.title,
    description: category.description,
    type: category.type,
    gameCount: category.gameCount,
    topGames: category.topGames,
    updatedAt: category.updatedAt
  };
}

export const categoryRankingService = new CategoryRankingService();
