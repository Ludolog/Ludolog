import { NextResponse } from "next/server";

import { requireCronSecret } from "@/lib/api";
import { getPlayerCountRefreshLimit, getPlayerCountRefreshMaxRuntimeMs } from "@/lib/config";
import { playerCountRefreshService } from "@/lib/services/player-count-refresh-service";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await playerCountRefreshService.refresh("top", getPlayerCountRefreshLimit(), undefined, {
    maxRuntimeMs: getPlayerCountRefreshMaxRuntimeMs()
  });
  return NextResponse.json(result);
}

export const POST = GET;
