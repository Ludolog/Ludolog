import { NextResponse } from "next/server";

import { isZodError, zodError } from "@/lib/api";
import { gameSearchService } from "@/lib/services/game-search-service";
import { searchQuerySchema } from "@/lib/validation";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const { q } = searchQuerySchema.parse({ q: url.searchParams.get("q") ?? "" });
    const results = await gameSearchService.searchCatalog(q);
    return NextResponse.json({ query: q, results });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
