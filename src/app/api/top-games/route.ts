import { NextResponse } from "next/server";

import { isZodError, zodError } from "@/lib/api";
import { topGamesService } from "@/lib/services/top-games-service";
import { topGamesQuerySchema } from "@/lib/validation";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const query = topGamesQuerySchema.parse({
      limit: Number(url.searchParams.get("limit") ?? 100),
      offset: Number(url.searchParams.get("offset") ?? 0),
      sort: url.searchParams.get("sort") ?? "players",
      category: url.searchParams.get("category") ?? undefined
    });
    return NextResponse.json(await topGamesService.list(query));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json({ error: "TOP 100 games failed." }, { status: 500 });
  }
}
