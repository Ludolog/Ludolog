import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { repositories } from "@/lib/repositories";
import { steamApiService } from "@/lib/services/steam-api-service";
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

  const current = await steamApiService.getCurrentPlayers(game.steamAppId);
  return NextResponse.json({
    gameId: game.id,
    current,
    history: await repositories.snapshots.listPlayers(game.id)
  });
}
