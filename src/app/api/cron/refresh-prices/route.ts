import { NextResponse } from "next/server";

import { requireCronSecret } from "@/lib/api";
import { priceRefreshScheduler } from "@/lib/services/price-refresh-scheduler";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await priceRefreshScheduler.refresh({ dryRun: false, mode: "scheduled" });
  return NextResponse.json(result);
}

export const POST = GET;
