import { NextResponse } from "next/server";

import { statsService } from "@/lib/services/stats-service";

export async function GET(): Promise<NextResponse> {
  const overview = await statsService.overview();
  return NextResponse.json({
    mode: overview.mode,
    results: overview.topPlayers,
    updatedAt: overview.updatedAt
  });
}
