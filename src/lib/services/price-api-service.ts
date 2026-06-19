import { repositories } from "@/lib/repositories";
import { priceProviderService } from "@/lib/services/price-provider-service";
import type { GamePriceSnapshot, StoreOffer } from "@/lib/types";

export class PriceApiService {
  async listOffers(gameId: string): Promise<StoreOffer[]> {
    return repositories.games.listOffers(gameId);
  }

  async getPriceHistory(gameId: string): Promise<GamePriceSnapshot[]> {
    return repositories.snapshots.listPrices(gameId);
  }

  refreshGamePrices(input: { gameId?: string; steamAppId?: number; dryRun?: boolean }) {
    return priceProviderService.refreshGamePrices(input);
  }

  refreshManyGamePrices(input: Parameters<typeof priceProviderService.refreshManyGamePrices>[0]) {
    return priceProviderService.refreshManyGamePrices(input);
  }
}

export const priceApiService = new PriceApiService();
