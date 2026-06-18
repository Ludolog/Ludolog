import { getDataMode, getOptionalEnv } from "@/lib/config";
import { repositories } from "@/lib/repositories";
import type { GamePriceSnapshot, StoreOffer } from "@/lib/types";

export class PriceApiService {
  async listOffers(gameId: string): Promise<StoreOffer[]> {
    if (getDataMode() === "api") {
      await this.tryExternalProvider(gameId);
    }

    return repositories.games.listOffers(gameId);
  }

  async getPriceHistory(gameId: string): Promise<GamePriceSnapshot[]> {
    return repositories.snapshots.listPrices(gameId);
  }

  private async tryExternalProvider(gameId: string): Promise<void> {
    const provider = getOptionalEnv("PRICE_API_PROVIDER") ?? "mock";
    const apiKey = getOptionalEnv("ISTHEREANYDEAL_API_KEY") ?? getOptionalEnv("GG_DEALS_API_KEY");

    if (provider === "mock" || !apiKey) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "price",
        level: "warning",
        message: `Price provider for ${gameId} is not configured. Mock offers were used.`
      });
      return;
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: "info",
      message: `Price provider ${provider} is configured. Adapter placeholder returned mock-safe data for ${gameId}.`
    });
  }
}

export const priceApiService = new PriceApiService();
