import { NextResponse } from "next/server";

import { isZodError, zodError } from "@/lib/api";
import { gameSearchService } from "@/lib/services/game-search-service";
import { searchQuerySchema } from "@/lib/validation";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const { q, limit, offset } = searchQuerySchema.parse({
      q: url.searchParams.get("q") ?? "",
      limit: Number(url.searchParams.get("limit") ?? 16),
      offset: Number(url.searchParams.get("offset") ?? 0)
    });
    return NextResponse.json(await gameSearchService.searchCatalog(q, { limit, offset }));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
