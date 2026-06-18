import { NextResponse } from "next/server";

import { jsonError, resolveRouteParams } from "@/lib/api";
import { snapshotService } from "@/lib/services/snapshot-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await resolveRouteParams(context.params);
  const profile = await snapshotService.refreshGame(id);

  if (!profile) {
    return jsonError("Game not found.", 404);
  }

  return NextResponse.json({ status: "refreshed", profile });
}
