import { describe, expect, it, vi } from "vitest";

import { ApiClientError, createApiClient, normalizeBaseUrl, type Fetcher } from "../mobile/src/api/client";

describe("mobile api client", () => {
  it("normalizes base URLs without hardcoding endpoints in components", () => {
    expect(normalizeBaseUrl("http://10.0.2.2:3000/")).toBe("http://10.0.2.2:3000");
  });

  it("calls backend endpoints relative to API_BASE_URL", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 })) as unknown as Fetcher;
    const client = createApiClient("http://10.0.2.2:3000/", fetcher);

    await client.getBestDeals(3);

    expect(fetcher).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/deals/best?limit=3",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("wraps network failures in a readable mobile error", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as Fetcher;
    const client = createApiClient("http://10.0.2.2:3000", fetcher);

    await expect(client.getAdminStatus()).rejects.toBeInstanceOf(ApiClientError);
  });
});
