import { repositories } from "@/lib/repositories";
import type { MockPriceCleanupPreview, MockPriceCleanupRun } from "@/lib/repositories/contracts";
import type { ApiMockPriceCleanupPreview, ApiMockPriceCleanupRunResponse } from "@shared/api-types";

const confirmationPhrase = "DELETE_MOCK_PRICE_DATA_ONLY" as const;

const whatWillBeDeleted = [
  "StoreOffer rows where source/provider is mock or the source is a mock PriceSource.",
  "GamePriceSnapshot rows where source/provider is mock or the source is a mock PriceSource.",
  "PriceSource rows marked as mock or named like mock seed data."
];

const whatWillBeKept = [
  "Game rows.",
  "SteamCatalogEntry rows.",
  "GogCatalogEntry rows.",
  "GameExternalMapping rows.",
  "PlayerCountSnapshot rows, including real Steam player snapshots.",
  "Manual/internal StoreOffer and GamePriceSnapshot rows.",
  "GOG StoreOffer and GamePriceSnapshot rows.",
  "Steam Store StoreOffer and GamePriceSnapshot rows."
];

export class PriceCleanupService {
  async preview(): Promise<ApiMockPriceCleanupPreview> {
    return toApiPreview(await repositories.prices.previewMockCleanup());
  }

  async run(confirm: string): Promise<ApiMockPriceCleanupRunResponse> {
    if (confirm !== confirmationPhrase) {
      throw new Error(`Cleanup requires confirm=${confirmationPhrase}.`);
    }

    const result = await repositories.prices.runMockCleanup();
    await repositories.diagnostics.recordIntegrationLog({
      service: "price-cleanup",
      level: "info",
      message: `Mock price cleanup finished. deletedOffers=${result.deletedStoreOffers}, deletedSnapshots=${result.deletedPriceSnapshots}, deletedSources=${result.deletedPriceSources}.`
    });
    return toApiRun(result);
  }
}

function toApiPreview(preview: MockPriceCleanupPreview): ApiMockPriceCleanupPreview {
  return {
    mode: "preview",
    ...preview,
    affectedGames: preview.affectedGames.slice(0, 50),
    examples: preview.examples,
    whatWillBeDeleted,
    whatWillBeKept,
    requiresConfirmation: confirmationPhrase,
    destructive: true
  };
}

function toApiRun(result: MockPriceCleanupRun): ApiMockPriceCleanupRunResponse {
  const { mode: _mode, ...preview } = toApiPreview(result);
  return {
    ...preview,
    mode: "run",
    deletedStoreOffers: result.deletedStoreOffers,
    deletedPriceSnapshots: result.deletedPriceSnapshots,
    deletedPriceSources: result.deletedPriceSources,
    completedAt: new Date().toISOString()
  };
}

export const priceCleanupService = new PriceCleanupService();
