import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/stats/overview/route";

describe("GET /api/stats/overview", () => {
  it("returns the expected stats overview shape", async () => {
    const response = await GET(new Request("http://localhost/api/stats/overview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.topPlayers)).toBe(true);
    expect(Array.isArray(body.trending)).toBe(true);
    expect(Array.isArray(body.bestValue)).toBe(true);
    expect(Array.isArray(body.categories)).toBe(true);
    expect(typeof body.updatedAt).toBe("string");
    expect(["mock", "mixed", "real"]).toContain(body.mode);
    expect(body.sourceCounts).toMatchObject({
      importedGames: expect.any(Number),
      steamCatalogEntries: expect.any(Number),
      realPlayerSnapshots: expect.any(Number),
      mockPlayerSnapshots: expect.any(Number)
    });
  });
});
