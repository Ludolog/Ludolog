import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as backfillCatalogPricesCron } from "@/app/api/cron/backfill-catalog-prices/route";
import { GET as refreshPlayerCountsCron } from "@/app/api/cron/refresh-player-counts/route";
import { GET as refreshPricesCron } from "@/app/api/cron/refresh-prices/route";
import { GET as refreshTopGamesCron } from "@/app/api/cron/refresh-top-games/route";

describe("cron endpoints", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects player refresh cron requests without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await refreshPlayerCountsCron(new Request("http://localhost/api/cron/refresh-player-counts"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized cron action.");
  });

  it("rejects requests with an invalid CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const response = await refreshPlayerCountsCron(
      new Request("http://localhost/api/cron/refresh-player-counts", {
        headers: { "x-cron-secret": "wrong-secret" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized cron action.");
  });

  it("accepts the CRON_SECRET through a bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const response = await refreshPlayerCountsCron(
      new Request("http://localhost/api/cron/refresh-player-counts", {
        headers: { authorization: "Bearer cron-secret" }
      })
    );

    expect(response.status).toBe(200);
  });

  it("protects the price refresh cron endpoint", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const unauthorized = await refreshPricesCron(new Request("http://localhost/api/cron/refresh-prices"));
    const authorized = await refreshPricesCron(
      new Request("http://localhost/api/cron/refresh-prices", {
        headers: { authorization: "Bearer cron-secret" }
      })
    );
    const body = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(body).toMatchObject({ source: "price-refresh", mode: "scheduled", dryRun: false });
  });

  it("protects the catalog backfill cron endpoint", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const unauthorized = await backfillCatalogPricesCron(new Request("http://localhost/api/cron/backfill-catalog-prices"));
    const authorized = await backfillCatalogPricesCron(
      new Request("http://localhost/api/cron/backfill-catalog-prices", {
        headers: { "x-cron-secret": "cron-secret" }
      })
    );
    const body = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(body).toMatchObject({ source: "price-refresh", mode: "catalog-backfill", dryRun: false });
  });

  it("protects the TOP 100 refresh cron endpoint", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("TOP_GAMES_REFRESH_ENABLED", "false");

    const unauthorized = await refreshTopGamesCron(new Request("http://localhost/api/cron/refresh-top-games"));
    const authorized = await refreshTopGamesCron(
      new Request("http://localhost/api/cron/refresh-top-games", {
        headers: { "x-cron-secret": "cron-secret" }
      })
    );
    const body = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(body).toMatchObject({ enabled: false });
  });
});
