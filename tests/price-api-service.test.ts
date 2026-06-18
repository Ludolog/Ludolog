import { describe, expect, it } from "vitest";

import { priceApiService } from "@/lib/services/price-api-service";

describe("PriceApiService", () => {
  it("returns mock offers for a configured game", async () => {
    const offers = await priceApiService.listOffers("cyberpunk-2077");

    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]?.price).toBeGreaterThan(0);
    expect(offers.some((offer) => offer.storeName === "GOG.com")).toBe(true);
  });
});
