import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/cron/refresh-player-counts/route";

describe("POST /api/cron/refresh-player-counts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to run in production without CRON_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(new Request("http://localhost/api/cron/refresh-player-counts", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("CRON_SECRET");
  });
});
