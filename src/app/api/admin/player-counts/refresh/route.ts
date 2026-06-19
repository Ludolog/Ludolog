import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { playerCountRefreshService } from "@/lib/services/player-count-refresh-service";
import { parseJsonBody, playerCountsRefreshSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(playerCountsRefreshSchema, await request.json());
    return NextResponse.json(await playerCountRefreshService.refresh(body.mode ?? "top", body.limit ?? 25, body.steamAppIds));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Player-count refresh failed." },
      { status: 500 }
    );
  }
}
