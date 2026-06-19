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
    slug: z.string().trim().min(1).max(120).optional()
  })
  .refine((value) => value.steamAppId !== undefined || value.slug !== undefined, {
    message: "steamAppId or slug is required."
  });

export const priceAlertCreateSchema = z.object({
  gameId: z.string().trim().min(1),
  thresholdPrice: z.number().positive().max(9999)
});

export function parseJsonBody<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
