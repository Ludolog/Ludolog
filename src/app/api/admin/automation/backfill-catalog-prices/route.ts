import { NextResponse } from "next/server";

import { requireAdminSecret } from "@/lib/api";
import { priceRefreshScheduler } from "@/lib/services/price-refresh-scheduler";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await safeJson(request);
  const result = await priceRefreshScheduler.backfillCatalog({ dryRun: body.dryRun !== false });
  return NextResponse.json(result);
}

async function safeJson(request: Request): Promise<{ dryRun?: boolean }> {
  try {
    return (await request.json()) as { dryRun?: boolean };
  } catch {
    return {};
  }
}
