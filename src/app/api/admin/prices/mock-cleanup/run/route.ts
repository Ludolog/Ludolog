import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { priceCleanupService } from "@/lib/services/price-cleanup-service";
import { mockPriceCleanupRunSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(mockPriceCleanupRunSchema, await request.json());
    return NextResponse.json(await priceCleanupService.run(body.confirm));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mock price cleanup failed." },
      { status: 400 }
    );
  }
}
