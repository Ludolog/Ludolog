import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as previewMockCleanup } from "@/app/api/admin/prices/mock-cleanup/preview/route";
import { POST as runMockCleanup } from "@/app/api/admin/prices/mock-cleanup/run/route";

describe("Mock price cleanup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires ADMIN_API_SECRET before showing the cleanup preview", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await previewMockCleanup(new Request("http://localhost/api/admin/prices/mock-cleanup/preview"));

    expect(response.status).toBe(401);
  });

  it("shows a safe cleanup preview without deleting data", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await previewMockCleanup(
      new Request("http://localhost/api/admin/prices/mock-cleanup/preview", {
        headers: { "x-admin-secret": "test-admin-secret" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      mode: "preview",
      destructive: true,
      requiresConfirmation: "DELETE_MOCK_PRICE_DATA_ONLY"
    });
    expect(body.whatWillBeKept).toContain("PlayerCountSnapshot rows, including real Steam player snapshots.");
    expect(body.whatWillBeDeleted.join(" ")).toContain("StoreOffer");
  });

  it("rejects cleanup run without the exact confirmation phrase", async () => {
    vi.stubEnv("ADMIN_API_SECRET", "test-admin-secret");

    const response = await runMockCleanup(
      new Request("http://localhost/api/admin/prices/mock-cleanup/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": "test-admin-secret"
        },
        body: JSON.stringify({ confirm: "NOPE" })
      })
    );

    expect(response.status).toBe(422);
  });
});
