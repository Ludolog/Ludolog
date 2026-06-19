import { NextResponse } from "next/server";

import { isZodError, jsonError, zodError } from "@/lib/api";
import { GameImportNotFoundError, gameSearchService } from "@/lib/services/game-search-service";
import { gameImportSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = parseJsonBody(gameImportSchema, await request.json());
    const response = await gameSearchService.importGame(body);
    return NextResponse.json(response, { status: response.imported ? 201 : 200 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    if (error instanceof GameImportNotFoundError) {
      return jsonError(error.message, 404);
    }

    return jsonError(error instanceof Error ? error.message : "Game import failed.", 400);
  }
}
