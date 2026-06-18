import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { repositories } from "@/lib/repositories";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await resolveRouteParams(context.params);
  const removed = await repositories.watchlist.remove(id);

  if (!removed) {
    return jsonError("Watchlist item not found.", 404);
  }

  return NextResponse.json({ status: "removed" });
}
