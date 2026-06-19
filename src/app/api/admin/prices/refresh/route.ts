import { NextResponse } from "next/server";

import { requireAdminSecret } from "@/lib/api";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json(
    {
      error: "Legacy external price refresh is disabled.",
      provider: "gamevalue",
      mode: "internal",
      replacementEndpoints: [
        "/api/admin/prices/manual-offer",
        "/api/admin/prices/import-json",
        "/api/admin/prices/import-csv",
        "/api/admin/prices/snapshot",
        "/api/admin/prices/recalculate"
      ]
    },
    { status: 410 }
  );
}
