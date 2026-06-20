import { describe, expect, it } from "vitest";

import {
  priceAlertCreateSchema,
  gogCatalogDiscoverSchema,
  gogMappingApproveSchema,
  gogMappingSuggestSchema,
  gogPriceRefreshSchema,
  playerCountsRefreshSchema,
  priceProviderDiagnosticsSchema,
  priceRefreshSchema,
  searchQuerySchema,
  steamCatalogSyncUntilSchema,
  steamStorePriceRefreshSchema,
  topGamesActionSchema,
  topGamesQuerySchema,
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

  it("accepts bounded GOG mapping suggestion and approval inputs", () => {
    const suggest = gogMappingSuggestSchema.parse({ mode: "imported-games", limit: 20 });
    const approve = gogMappingApproveSchema.parse({ gameId: "the-witcher-3", gogProductId: "1207658924" });

    expect(suggest).toMatchObject({ mode: "imported-games", limit: 20 });
    expect(approve).toMatchObject({ gameId: "the-witcher-3", gogProductId: "1207658924", confidence: "manual" });
    expect(() => gogMappingSuggestSchema.parse({ mode: "imported-games", limit: 500 })).toThrow();
  });

  it("accepts bounded Steam Store catalog backfill input", () => {
    const payload = steamStorePriceRefreshSchema.parse({ mode: "catalog-backfill", limit: 10, dryRun: true });

    expect(payload).toMatchObject({ mode: "catalog-backfill", limit: 10, dryRun: true });
    expect(() => steamStorePriceRefreshSchema.parse({ mode: "catalog-backfill", limit: 500 })).toThrow();
  });

  it("accepts bounded TOP 100 refresh and query inputs", () => {
    const action = topGamesActionSchema.parse({ limit: 100 });
    const query = topGamesQuerySchema.parse({ limit: 25, offset: 10, sort: "score", category: "rpg" });
    const playerRefresh = playerCountsRefreshSchema.parse({ mode: "top-100", limit: 100 });
    const steamStoreRefresh = steamStorePriceRefreshSchema.parse({ mode: "top-100", limit: 100, dryRun: true });

    expect(action).toMatchObject({ limit: 100, dryRun: true });
    expect(query).toMatchObject({ limit: 25, offset: 10, sort: "score", category: "rpg" });
    expect(playerRefresh).toMatchObject({ mode: "top-100", limit: 100 });
    expect(steamStoreRefresh).toMatchObject({ mode: "top-100", limit: 100, dryRun: true });
    expect(() => topGamesActionSchema.parse({ limit: 101 })).toThrow();
    expect(() => topGamesQuerySchema.parse({ sort: "all-catalog" })).toThrow();
  });
});
