import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { GogConnectorError, gogService } from "@/lib/services/gog-service";
import { gogCatalogSearchSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(gogCatalogSearchSchema, await request.json());
    return NextResponse.json(await gogService.searchCatalog(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "GOG catalog search failed." }, { status: statusFor(error) });
  }
}

function statusFor(error: unknown): number {
  if (error instanceof GogConnectorError && error.errorType === "disabled") {
    return 503;
  }
  return 500;
}
