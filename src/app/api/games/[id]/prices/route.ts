import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { priceApiService } from "@/lib/services/price-api-service";
import { gameSearchService } from "@/lib/services/game-search-service";

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

  return NextResponse.json({ gameId: game.id, history, offers });
}
