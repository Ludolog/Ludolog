import { NextResponse } from "next/server";

import { steamCatalogStatusService } from "@/lib/services/steam-catalog-status-service";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await steamCatalogStatusService.getStatus());
}
