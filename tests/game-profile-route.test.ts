import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/games/[id]/route";

describe("GET /api/games/:id", () => {
  it("returns a game profile with score, history and offers", async () => {
    const response = await GET(new Request("http://localhost/api/games/cyberpunk-2077"), {
      params: Promise.resolve({ id: "cyberpunk-2077" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.game.title).toBe("Cyberpunk 2077");
    expect(body.score.score).toBeGreaterThanOrEqual(0);
    expect(body.priceHistory.length).toBeGreaterThan(0);
    expect(body.offers.length).toBeGreaterThan(0);
  });

  it("returns 404 for missing games", async () => {
    const response = await GET(new Request("http://localhost/api/games/missing"), {
      params: Promise.resolve({ id: "missing" })
    });

    expect(response.status).toBe(404);
  });
});
