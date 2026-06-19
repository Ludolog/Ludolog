import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { GogConnectorError, gogService } from "@/lib/services/gog-service";
import { gogResolveGameSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(gogResolveGameSchema, await request.json());
    return NextResponse.json(await gogService.resolveGame(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "GOG game resolution failed." }, { status: statusFor(error) });
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
