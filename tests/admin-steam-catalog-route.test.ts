import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/steam-catalog/status/route";
import { POST } from "@/app/api/admin/steam-catalog/sync/route";

describe("Steam catalog admin routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects sync without x-admin-secret when ADMIN_API_SECRET is configured", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await POST(
      new Request("http://localhost/api/admin/steam-catalog/sync", {
        method: "POST",
        body: JSON.stringify({ dryRun: true, maxPages: 1, maxResults: 100 })
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects sync with an invalid x-admin-secret", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await POST(
      new Request("http://localhost/api/admin/steam-catalog/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "wrong-secret"
        },
        body: JSON.stringify({ dryRun: true, maxPages: 1, maxResults: 100 })
      })
    );

    expect(response.status).toBe(401);
  });

  it("disables sync when ADMIN_API_SECRET is missing", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "");

    const response = await POST(
      new Request("http://localhost/api/admin/steam-catalog/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true, maxPages: 1, maxResults: 100 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("ADMIN_API_SECRET");
  });

  it("runs sync with a valid x-admin-secret", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");
    vi.stubEnv("STEAM_WEB_API_KEY", "");

    const response = await POST(
      new Request("http://localhost/api/admin/steam-catalog/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ dryRun: true, maxPages: 1, maxResults: 100 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.source).toBe("mock-fallback");
  });

  it("includes a safe sync cursor in public status", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("nextSteamCatalogStartAfterAppId");
    expect(body).not.toHaveProperty("steamWebApiKey");
    expect(body).not.toHaveProperty("adminApiSecret");
  });

  it("does not expose configured secrets in public status", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "steam-key-that-must-not-leak");
    vi.stubEnv("ADMIN_API_SECRET", "admin-secret-that-must-not-leak");

    const response = await GET();
    const body = await response.json();
    const text = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.hasSteamApiKey).toBe(true);
    expect(body).not.toHaveProperty("steamWebApiKey");
    expect(body).not.toHaveProperty("adminApiSecret");
    expect(text).not.toContain("steam-key-that-must-not-leak");
    expect(text).not.toContain("admin-secret-that-must-not-leak");
  });
});
