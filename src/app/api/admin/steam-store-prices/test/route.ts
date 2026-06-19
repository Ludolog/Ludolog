import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { SteamStoreConnectorError, steamStorePriceService } from "@/lib/services/steam-store-price-service";
import { parseJsonBody, steamStorePriceTestSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(steamStorePriceTestSchema, await request.json());
    return NextResponse.json(await steamStorePriceService.testPrice(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json(
      {
        configured: false,
        result: null,
        error: error instanceof Error ? error.message : "Steam Store price test failed."
      },
      { status: statusFor(error) }
    );
  }
}

function statusFor(error: unknown): number {
  if (error instanceof SteamStoreConnectorError && error.errorType === "disabled") {
    return 503;
  }
  if (error instanceof SteamStoreConnectorError && error.errorType === "no_price_data") {
    return 404;
  }
  return 500;
}
