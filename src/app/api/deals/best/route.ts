import { NextResponse } from "next/server";

import { gameSearchService } from "@/lib/services/game-search-service";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 5);
  return NextResponse.json({ results: await gameSearchService.bestDeals(Number.isFinite(limit) ? limit : 5) });
}
