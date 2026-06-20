import { describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  createApiClient,
  createCapacitorHttpTransport,
  createFetchTransport,
  normalizeBaseUrl,
  type Fetcher
} from "../mobile/src/api/client";

describe("mobile api client", () => {
  it("normalizes base URLs without hardcoding endpoints in components", () => {
    expect(normalizeBaseUrl("http://10.0.2.2:3000/")).toBe("http://10.0.2.2:3000");
  });

  it("uses fetch on web and does not add Content-Type for GET", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const client = createApiClient("https://apka-seven.vercel.app/", createFetchTransport(fetcher as unknown as Fetcher));

    await client.getBestDeals(3);

    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const headers = options.headers as Headers;

    expect(url).toBe("https://apka-seven.vercel.app/api/deals/best?limit=3");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("uses CapacitorHttp transport for native requests", async () => {
    const request = vi.fn(async () => ({
      data: { mode: "mock" },
      headers: {},
      status: 200,
      url: "https://apka-seven.vercel.app/api/admin/status"
    }));
    const client = createApiClient(
      "https://apka-seven.vercel.app",
      createCapacitorHttpTransport({ request } as never)
    );

    await client.getAdminStatus();

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/json"
        }),
        method: "GET",
        url: "https://apka-seven.vercel.app/api/admin/status"
      })
    );
  });

  it("wraps network failures in a readable mobile error", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = createApiClient("https://apka-seven.vercel.app", createFetchTransport(fetcher as unknown as Fetcher));

    await expect(client.getAdminStatus()).rejects.toMatchObject({
      baseUrl: "https://apka-seven.vercel.app",
      details: "network down",
      endpoint: "/api/admin/status",
      message: "network down",
      type: "network",
      url: "https://apka-seven.vercel.app/api/admin/status"
    });
  });

  it("includes HTTP status and URL for non-200 responses", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "not allowed" }), { status: 403 }));
    const client = createApiClient("https://apka-seven.vercel.app", createFetchTransport(fetcher as unknown as Fetcher));

    await expect(client.getAdminStatus()).rejects.toMatchObject({
      baseUrl: "https://apka-seven.vercel.app",
      details: "not allowed",
      endpoint: "/api/admin/status",
      status: 403,
      type: "http",
      url: "https://apka-seven.vercel.app/api/admin/status"
    } satisfies Partial<ApiClientError>);
  });

  it("calls the stats overview endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ topPlayers: [], trending: [], bestValue: [], categories: [], mode: "mock", updatedAt: "2026-06-19T00:00:00.000Z" }), { status: 200 }));
    const client = createApiClient("https://apka-seven.vercel.app", createFetchTransport(fetcher as unknown as Fetcher));

    await client.getStatsOverview();

    expect(fetcher.mock.calls[0]?.[0]).toBe("https://apka-seven.vercel.app/api/stats/overview");
  });

  it("calls the game prices endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ gameId: "dota-2", history: [], offers: [] }), { status: 200 }));
    const client = createApiClient("https://apka-seven.vercel.app", createFetchTransport(fetcher as unknown as Fetcher));

    await client.getGamePrices("dota-2");

    expect(fetcher.mock.calls[0]?.[0]).toBe("https://apka-seven.vercel.app/api/games/dota-2/prices");
  });

  it("calls the TOP 100 endpoint with a bounded limit", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0, coverage: {} }), { status: 200 }));
    const client = createApiClient("https://apka-seven.vercel.app", createFetchTransport(fetcher as unknown as Fetcher));

    await client.getTopGames(12);

    expect(fetcher.mock.calls[0]?.[0]).toBe("https://apka-seven.vercel.app/api/top-games?limit=12");
  });

  it("posts catalog imports as JSON and reads the richer response", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          created: true,
          gameId: "palworld",
          imported: true,
          source: "mock-catalog",
          steamAppId: 1623730,
          summary: { game: { id: "palworld" } }
        }),
        { status: 201 }
      )
    );
    const client = createApiClient("https://apka-seven.vercel.app", createFetchTransport(fetcher as unknown as Fetcher));

    const response = await client.importGame({ steamAppId: 1623730 });

    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(url).toBe("https://apka-seven.vercel.app/api/games/import");
    expect(options.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ steamAppId: 1623730 }));
    expect(response).toMatchObject({
      created: true,
      gameId: "palworld",
      source: "mock-catalog",
      steamAppId: 1623730
    });
  });
});
