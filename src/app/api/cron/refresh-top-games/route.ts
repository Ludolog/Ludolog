import { NextResponse } from "next/server";

import {
  getTopGamesPlayerRefreshLimit,
  getTopGamesPriceRefreshLimit,
  isTopGamesRefreshEnabled
} from "@/lib/config";
import { requireCronSecret } from "@/lib/api";
import { topGamesService } from "@/lib/services/top-games-service";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  if (!isTopGamesRefreshEnabled()) {
    return NextResponse.json({
      enabled: false,
      message: "TOP 100 refresh is disabled by TOP_GAMES_REFRESH_ENABLED=false."
    });
  }

  const players = await topGamesService.refreshPlayers({
    limit: getTopGamesPlayerRefreshLimit(),
    dryRun: false
  });
  const prices = await topGamesService.refreshPrices({
    limit: getTopGamesPriceRefreshLimit(),
    dryRun: false
  });

  return NextResponse.json({
    enabled: true,
    source: "top-games",
    dryRun: false,
    players,
    prices,
    coverage: await topGamesService.coverage()
  });
}

export const POST = GET;
