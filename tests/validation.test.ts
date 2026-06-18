import { describe, expect, it } from "vitest";

import { priceAlertCreateSchema, searchQuerySchema, watchlistCreateSchema } from "@/lib/validation";

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
});
