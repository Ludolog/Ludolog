import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { topGamesService } from "@/lib/services/top-games-service";
import { parseJsonBody, topGamesActionSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(topGamesActionSchema, await request.json());
    return NextResponse.json(await topGamesService.refreshPlayers(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "TOP 100 player refresh failed." }, { status: 500 });
  }
}
