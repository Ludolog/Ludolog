import { NextResponse } from "next/server";

import { isZodError, zodError } from "@/lib/api";
import { steamCatalogSyncService } from "@/lib/services/steam-catalog-sync-service";
import { parseJsonBody, steamCatalogSyncSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = parseJsonBody(steamCatalogSyncSchema, await request.json());
    const result = await steamCatalogSyncService.sync(body);
    return NextResponse.json(result);
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Steam catalog sync failed." },
      { status: 500 }
    );
  }
}
