import { NextResponse } from "next/server";

import { getCronSecret } from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { playerCountRefreshService } from "@/lib/services/player-count-refresh-service";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = getCronSecret();
  const provided = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!secret) {
    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: "warning",
      message: "Cron refresh-player-counts ran without CRON_SECRET in non-production mode."
    });
  }

  const result = await playerCountRefreshService.refresh("top", 25);
  return NextResponse.json(result);
}
