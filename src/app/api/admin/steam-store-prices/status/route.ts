import { NextResponse } from "next/server";

import { steamStorePriceService } from "@/lib/services/steam-store-price-service";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await steamStorePriceService.status());
}
