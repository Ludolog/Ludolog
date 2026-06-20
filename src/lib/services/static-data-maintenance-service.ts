import { isApiMode, isDevMockFallbackEnabled } from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { priceCleanupService } from "@/lib/services/price-cleanup-service";

const confirmationPhrase = "REMOVE_STATIC_MOCK_DATA_ONLY" as const;

export class StaticDataMaintenanceService {
  async preview() {
    const pricePreview = await priceCleanupService.preview();
    return {
      mode: "preview" as const,
      destructive: true,
      requiresConfirmation: confirmationPhrase,
      productionMockFallbackEnabled: isApiMode() && isDevMockFallbackEnabled(),
      devMockFallbackEnabled: isDevMockFallbackEnabled(),
      mockPriceData: pricePreview,
      whatWillBeDeleted: pricePreview.whatWillBeDeleted,
      whatWillBeKept: [
        ...pricePreview.whatWillBeKept,
        "Runtime mock catalog/player fallback remains disabled in api mode unless ENABLE_DEV_MOCK_FALLBACK=true."
      ]
    };
  }

  async run(confirm: string) {
    if (confirm !== confirmationPhrase) {
      throw new Error(`Static data maintenance requires confirm=${confirmationPhrase}.`);
    }
    const priceRun = await priceCleanupService.run("DELETE_MOCK_PRICE_DATA_ONLY");
    await repositories.diagnostics.recordIntegrationLog({
      service: "price-cleanup",
      level: "info",
      message: `Static/mock data maintenance finished. deletedOffers=${priceRun.deletedStoreOffers}, deletedSnapshots=${priceRun.deletedPriceSnapshots}, deletedSources=${priceRun.deletedPriceSources}.`
    });
    return {
      ...(await this.preview()),
      mode: "run" as const,
      mockPriceData: priceRun,
      completedAt: new Date().toISOString()
    };
  }
}

export const staticDataMaintenanceService = new StaticDataMaintenanceService();
