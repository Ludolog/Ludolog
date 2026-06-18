import { repositories } from "@/lib/repositories";
import type { Game, GameProfile, GameSummary } from "@/lib/types";

export class GameSearchService {
  list(): Promise<Game[]> {
    return repositories.games.list();
  }

  search(query: string): Promise<GameSummary[]> {
    return repositories.games.search(query);
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

export const gameSearchService = new GameSearchService();
