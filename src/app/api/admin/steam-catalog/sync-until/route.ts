import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { steamCatalogSyncService } from "@/lib/services/steam-catalog-sync-service";
import { parseJsonBody, steamCatalogSyncUntilSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(steamCatalogSyncUntilSchema, await request.json());
    const result = await steamCatalogSyncService.syncUntil(body);
    return NextResponse.json(result);
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Steam catalog sync-until failed." },
      { status: 500 }
    );
  }
}
