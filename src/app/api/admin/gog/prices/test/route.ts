import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { GogConnectorError, gogService } from "@/lib/services/gog-service";
import { gogPriceTestSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(gogPriceTestSchema, await request.json());
    return NextResponse.json(await gogService.testPrice(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json(
      {
        configured: false,
        result: null,
        error: error instanceof Error ? error.message : "GOG price test failed."
      },
      { status: statusFor(error) }
    );
  }
}

function statusFor(error: unknown): number {
  if (error instanceof GogConnectorError && error.errorType === "disabled") {
    return 503;
  }
  if (error instanceof GogConnectorError && error.errorType === "not_found") {
    return 404;
  }
  return 500;
}
