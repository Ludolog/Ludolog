import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Search query is required.")
    .max(80, "Search query is too long.")
});

export const gameIdSchema = z.object({
  id: z.string().trim().min(1).max(120)
});

export const watchlistCreateSchema = z.object({
  gameId: z.string().trim().min(1),
  targetPrice: z.number().positive().max(9999).nullable().optional()
});

export const gameImportSchema = z
  .object({
    steamAppId: z.number().int().positive().optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    query: z.string().trim().min(1).max(120).optional()
  })
  .refine((value) => value.steamAppId !== undefined || value.slug !== undefined || value.query !== undefined, {
    message: "steamAppId, slug or query is required."
  });

export const adminBulkImportSchema = z
  .object({
    steamAppIds: z.array(z.number().int().positive()).max(50).optional(),
    queries: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    refreshPlayers: z.boolean().default(true),
    limit: z.number().int().positive().max(50).default(20)
  })
  .refine((value) => (value.steamAppIds?.length ?? 0) > 0 || (value.queries?.length ?? 0) > 0, {
    message: "steamAppIds or queries are required."
  });

export const steamCatalogSyncSchema = z.object({
  dryRun: z.boolean().optional(),
  maxPages: z.number().int().positive().max(10).optional(),
  maxResults: z.number().int().positive().max(5000).optional(),
  startAfterAppId: z.number().int().positive().optional()
});

export const playerCountsRefreshSchema = z.object({
  mode: z.enum(["watchlist", "top", "all-imported"]).default("top"),
  limit: z.number().int().positive().max(50).default(25),
  steamAppIds: z.array(z.number().int().positive()).max(50).optional()
});

export const priceRefreshSchema = z.object({
  mode: z.enum(["imported", "best"]).default("imported"),
  limit: z.number().int().positive().max(50).default(10),
  steamAppIds: z.array(z.number().int().positive()).max(50).optional(),
  dryRun: z.boolean().default(false)
});

export const priceProviderDiagnosticsSchema = z.object({
  provider: z.literal("ggdeals").default("ggdeals"),
  steamAppIds: z.array(z.number().int().positive()).max(5).default([570]),
  dryRun: z.boolean().default(true)
});

export const manualOfferSchema = z.object({
  steamAppId: z.number().int().positive(),
  storeName: z.string().trim().min(1).max(120),
  storeType: z.enum(["official", "keyshop", "marketplace", "unknown"]).default("unknown"),
  price: z.number().min(0).max(99999),
  regularPrice: z.number().min(0).max(99999).nullable().optional(),
  currency: z.string().trim().min(3).max(3).default("PLN"),
  externalUrl: z.string().trim().url().nullable().optional(),
  region: z.string().trim().min(2).max(8).default("PL"),
  drm: z.string().trim().min(1).max(60).default("Steam"),
  platform: z.string().trim().min(1).max(60).optional(),
  isOfficialStore: z.boolean().default(false),
  available: z.boolean().default(true),
  sourceName: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(180).optional()
});

export const priceImportJsonSchema = z.object({
  sourceName: z.string().trim().min(1).max(120),
  offers: z.array(manualOfferSchema).min(1).max(200)
});

export const priceImportCsvSchema = z.object({
  sourceName: z.string().trim().min(1).max(120),
  csv: z.string().trim().min(1).max(200_000)
});

export const priceSnapshotSchema = z.object({
  steamAppId: z.number().int().positive(),
  sourceName: z.string().trim().min(1).max(120).optional()
});

export const priceAlertCreateSchema = z.object({
  gameId: z.string().trim().min(1),
  thresholdPrice: z.number().positive().max(9999)
});

export const gogCatalogSearchSchema = z.object({
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().positive().max(25).default(10)
});

export const gogMappingSchema = z.object({
  gameId: z.string().trim().min(1).max(120),
  gogProductId: z.string().trim().min(1).max(80),
  externalSlug: z.string().trim().min(1).max(160).nullable().optional(),
  confidence: z.enum(["exact", "title-match", "manual", "unknown"]).default("manual")
});

export const gogResolveGameSchema = z.object({
  gameId: z.string().trim().min(1).max(120),
  limit: z.number().int().positive().max(25).default(10)
});

export const gogPriceTestSchema = z.object({
  gogProductId: z.string().trim().min(1).max(80),
  externalSlug: z.string().trim().min(1).max(160).nullable().optional(),
  countryCode: z.string().trim().min(2).max(2).optional(),
  currency: z.string().trim().min(3).max(3).optional()
});

export const gogPriceRefreshSchema = z.object({
  mode: z.literal("mapped-games").default("mapped-games"),
  gameIds: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  limit: z.number().int().positive().max(10).default(10)
});

export function parseJsonBody<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
