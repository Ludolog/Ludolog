import { NextResponse } from "next/server";

import { statsService } from "@/lib/services/stats-service";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 8);
  return NextResponse.json(await statsService.overview(Number.isFinite(limit) ? limit : 8));
}
