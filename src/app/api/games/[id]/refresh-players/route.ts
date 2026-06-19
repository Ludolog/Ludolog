import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { gameSearchService } from "@/lib/services/game-search-service";
import { steamApiService } from "@/lib/services/steam-api-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await resolveRouteParams(context.params);
  const game = await gameSearchService.findGame(id);

  if (!game) {
    return jsonError("Game not found.", 404);
  }

  const snapshot = await steamApiService.refreshPlayerCount(game.steamAppId);
  const profile = await gameSearchService.getProfile(game.id);
  return NextResponse.json({ snapshot, profile });
}
