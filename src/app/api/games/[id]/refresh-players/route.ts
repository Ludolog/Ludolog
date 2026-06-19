import { NextResponse } from "next/server";

import { jsonError, requireAdminSecret, resolveRouteParams } from "@/lib/api";
import { gameSearchService } from "@/lib/services/game-search-service";
import { steamApiService } from "@/lib/services/steam-api-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await resolveRouteParams(context.params);
  const game = await gameSearchService.findGame(id);

  if (!game) {
    return jsonError("Game not found.", 404);
  }

  const snapshot = await steamApiService.refreshPlayerCount(game.steamAppId);
  const profile = await gameSearchService.getProfile(game.id);
  return NextResponse.json({ snapshot, profile });
}
