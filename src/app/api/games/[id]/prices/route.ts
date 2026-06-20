import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { getSteamStorePriceStaleHours } from "@/lib/config";
import { priceApiService } from "@/lib/services/price-api-service";
import { gameSearchService } from "@/lib/services/game-search-service";
import { isTrustedPriceSource } from "@/lib/services/price-source-utils";
import type { PriceFreshness } from "@shared/api-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await resolveRouteParams(context.params);
  const game = await gameSearchService.findGame(id);

  if (!game) {
    return jsonError("Game not found.", 404);
  }

  const [history, offers] = await Promise.all([
    priceApiService.getPriceHistory(game.id),
    priceApiService.listOffers(game.id)
  ]);
  const publicHistory = history.filter((snapshot) => isTrustedPriceSource(snapshot.source));
  const publicOffers = offers.filter((offer) => isTrustedPriceSource(offer.source));
  const latestPriceRefresh = [...publicHistory].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  )[0]?.capturedAt ?? null;
  const freshness = priceFreshness(latestPriceRefresh);

  return NextResponse.json({
    gameId: game.id,
    history: publicHistory,
    offers: publicOffers,
    freshness: {
      latestPriceRefresh,
      freshness,
      nextRefreshAt: latestPriceRefresh ? nextRefreshAt(latestPriceRefresh) : null
    }
  });
}

function priceFreshness(latestPriceRefresh: Date | string | null): PriceFreshness {
  if (!latestPriceRefresh) {
    return "no-data";
  }
  const staleMs = getSteamStorePriceStaleHours() * 60 * 60 * 1000;
  return Date.now() - new Date(latestPriceRefresh).getTime() > staleMs ? "stale" : "fresh";
}

function nextRefreshAt(latestPriceRefresh: Date | string): string {
  const next = new Date(new Date(latestPriceRefresh).getTime() + getSteamStorePriceStaleHours() * 60 * 60 * 1000);
  return next.toISOString();
}
