import { NextResponse } from "next/server";

import { priceApiService } from "@/lib/services/price-api-service";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await priceApiService.status());
}
