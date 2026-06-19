import { describe, expect, it, vi } from "vitest";

import { ApiClientError, createApiClient, normalizeBaseUrl, type Fetcher } from "../mobile/src/api/client";

describe("mobile api client", () => {
  it("normalizes base URLs without hardcoding endpoints in components", () => {
    expect(normalizeBaseUrl("http://10.0.2.2:3000/")).toBe("http://10.0.2.2:3000");
  });

  it("calls backend endpoints relative to API_BASE_URL", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const client = createApiClient("http://10.0.2.2:3000/", fetcher as unknown as Fetcher);

    await client.getBestDeals(3);

    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const headers = options.headers as Headers;

    expect(url).toBe("http://10.0.2.2:3000/api/deals/best?limit=3");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("wraps network failures in a readable mobile error", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = createApiClient("http://10.0.2.2:3000", fetcher as unknown as Fetcher);

    await expect(client.getAdminStatus()).rejects.toMatchObject({
      baseUrl: "http://10.0.2.2:3000",
      endpoint: "/api/admin/status",
      message: "network down",
      type: "network",
      url: "http://10.0.2.2:3000/api/admin/status"
    });
  });
});
