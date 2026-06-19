import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { priceProviderService } from "@/lib/services/price-provider-service";
import { parseJsonBody, priceRefreshSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(priceRefreshSchema, await request.json());
    return NextResponse.json(await priceProviderService.refreshManyGamePrices({ ...body, mode: "best" }));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Best price refresh failed." },
      { status: 500 }
    );
  }
}
