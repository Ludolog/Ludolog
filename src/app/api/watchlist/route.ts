import { NextResponse } from "next/server";

import { isZodError, zodError } from "@/lib/api";
import { repositories } from "@/lib/repositories";
import { parseJsonBody, watchlistCreateSchema } from "@/lib/validation";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ results: await repositories.watchlist.list() });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const payload = parseJsonBody(watchlistCreateSchema, body);
    const item = await repositories.watchlist.add(payload.gameId, payload.targetPrice);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json({ error: "Could not update watchlist." }, { status: 500 });
  }
}
