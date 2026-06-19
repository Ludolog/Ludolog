import { NextResponse } from "next/server";

import { categoryRankingService } from "@/lib/services/category-service";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await categoryRankingService.overview());
}
