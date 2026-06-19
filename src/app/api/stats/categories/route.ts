import { NextResponse } from "next/server";

import { statsService } from "@/lib/services/stats-service";

export async function GET(): Promise<NextResponse> {
  const overview = await statsService.overview();
  return NextResponse.json({
    categories: overview.categories,
    mode: overview.mode,
    updatedAt: overview.updatedAt
  });
}
