import { describe, expect, it } from "vitest";

import {
  priceAlertCreateSchema,
  gogCatalogDiscoverSchema,
  gogPriceRefreshSchema,
  priceProviderDiagnosticsSchema,
  priceRefreshSchema,
  searchQuerySchema,
  steamCatalogSyncUntilSchema,
  watchlistCreateSchema
} from "@/lib/validation";

describe("validation schemas", () => {
  it("rejects empty search queries", () => {
    expect(() => searchQuerySchema.parse({ q: "" })).toThrow();
  });

  it("accepts watchlist input with an optional target price", () => {
    const payload = watchlistCreateSchema.parse({ gameId: "terraria", targetPrice: 12.5 });

    expect(payload.gameId).toBe("terraria");
    expect(payload.targetPrice).toBe(12.5);
  });

  it("rejects invalid alert prices", () => {
    expect(() => priceAlertCreateSchema.parse({ gameId: "terraria", thresholdPrice: -2 })).toThrow();
  });

  it("accepts bounded admin price refresh input", () => {
    const payload = priceRefreshSchema.parse({ steamAppIds: [570, 730], limit: 2, dryRun: true });

    expect(payload.mode).toBe("imported");
    expect(payload.steamAppIds).toEqual([570, 730]);
    expect(payload.dryRun).toBe(true);
  });

  it("accepts bounded GG.deals provider diagnostics input", () => {
    const payload = priceProviderDiagnosticsSchema.parse({ steamAppIds: [570, 730] });

    expect(payload.provider).toBe("ggdeals");
    expect(payload.dryRun).toBe(true);
    expect(payload.steamAppIds).toEqual([570, 730]);
    expect(() => priceProviderDiagnosticsSchema.parse({ steamAppIds: [1, 2, 3, 4, 5, 6] })).toThrow();
  });

  it("accepts bounded Steam sync-until input", () => {
    const payload = steamCatalogSyncUntilSchema.parse({ targetCount: 2000 });

    expect(payload).toMatchObject({ targetCount: 2000, batchSize: 500, maxBatches: 4, dryRun: true });
    expect(() => steamCatalogSyncUntilSchema.parse({ targetCount: 2000, batchSize: 5000 })).toThrow();
  });

  it("requires either a GOG discovery mode or explicit queries", () => {
    const payload = gogCatalogDiscoverSchema.parse({ mode: "imported-games" });

    expect(payload).toMatchObject({ mode: "imported-games", limit: 20 });
    expect(() => gogCatalogDiscoverSchema.parse({ limit: 10 })).toThrow();
  });

  it("defaults GOG price refresh to dry run", () => {
    const payload = gogPriceRefreshSchema.parse({ mode: "mapped-games", limit: 1 });

    expect(payload).toMatchObject({ mode: "mapped-games", limit: 1, dryRun: true });
  });
});
