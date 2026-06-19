import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { priceApiService } from "@/lib/services/price-api-service";
import { manualOfferSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(manualOfferSchema, await request.json());
    return NextResponse.json(await priceApiService.addManualOffer(body), { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual offer ingestion failed." },
      { status: 500 }
    );
  }
}
