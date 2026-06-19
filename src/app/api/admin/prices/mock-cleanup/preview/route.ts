import { NextResponse } from "next/server";

import { requireAdminSecret } from "@/lib/api";
import { priceCleanupService } from "@/lib/services/price-cleanup-service";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json(await priceCleanupService.preview());
}
