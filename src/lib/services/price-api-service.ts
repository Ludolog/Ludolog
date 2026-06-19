import { repositories } from "@/lib/repositories";
import { gameValuePriceService } from "@/lib/services/gamevalue-price-service";
import type { GamePriceSnapshot, StoreOffer } from "@/lib/types";
import type {
  ApiManualOfferRequest,
  ApiPriceImportCsvRequest,
  ApiPriceImportJsonRequest,
  ApiPriceSnapshotRequest
} from "@shared/api-types";

export class PriceApiService {
  async listOffers(gameId: string): Promise<StoreOffer[]> {
    return repositories.games.listOffers(gameId);
  }

  async getPriceHistory(gameId: string): Promise<GamePriceSnapshot[]> {
    return repositories.snapshots.listPrices(gameId);
  }

  status() {
    return gameValuePriceService.status();
  }

  addManualOffer(input: ApiManualOfferRequest) {
    return gameValuePriceService.addManualOffer(input);
  }

  importJson(input: ApiPriceImportJsonRequest) {
    return gameValuePriceService.importJson(input);
  }

  importCsv(input: ApiPriceImportCsvRequest) {
    return gameValuePriceService.importCsv(input);
  }

  snapshot(input: ApiPriceSnapshotRequest) {
    return gameValuePriceService.snapshot(input);
  }

  recalculate() {
    return gameValuePriceService.recalculate();
  }
}

export const priceApiService = new PriceApiService();
