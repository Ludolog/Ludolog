import { NextResponse } from "next/server";

import { requireAdminSecret } from "@/lib/api";
import { priceApiService } from "@/lib/services/price-api-service";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json(await priceApiService.recalculate());
}
