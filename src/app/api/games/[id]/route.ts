import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { gameSearchService } from "@/lib/services/game-search-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await resolveRouteParams(context.params);
  const profile = await gameSearchService.getProfile(id);

  if (!profile) {
    return jsonError("Game not found.", 404);
  }

  return NextResponse.json(profile);
}
