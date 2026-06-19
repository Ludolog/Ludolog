import { mockGameCatalog } from "@/lib/mock-data";
import type { GameImportInput } from "@/lib/types";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMatch(game: GameImportInput, query: string): number {
  const normalizedQuery = normalize(query);
  const title = normalize(game.title);
  const slug = normalize(game.slug);
  const tags = normalize(game.genres.join(" "));

  if (title === normalizedQuery || slug === normalizedQuery) {
    return 100;
  }
  if (title.startsWith(normalizedQuery) || slug.startsWith(normalizedQuery)) {
    return 80;
  }
  if (title.includes(normalizedQuery) || slug.includes(normalizedQuery)) {
    return 65;
  }
  if (tags.includes(normalizedQuery)) {
    return 35;
  }
  return 0;
}

export class SteamAppCatalogService {
  search(query: string, limit = 12): GameImportInput[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    return mockGameCatalog
      .map((game) => ({ game, score: scoreMatch(game, trimmed) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.game.currentPlayers - a.game.currentPlayers)
      .slice(0, limit)
      .map((item) => item.game);
  }

  findBySteamAppId(steamAppId: number): GameImportInput | null {
    return mockGameCatalog.find((game) => game.steamAppId === steamAppId) ?? null;
  }

  findBySlug(slug: string): GameImportInput | null {
    return mockGameCatalog.find((game) => game.slug === slug || game.id === slug) ?? null;
  }
}

export const steamAppCatalogService = new SteamAppCatalogService();
