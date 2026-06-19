import { NextResponse } from "next/server";

import { requireAdminSecret } from "@/lib/api";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json(
    {
      error: "Legacy GG.deals diagnostics are disabled.",
      provider: "gamevalue",
      mode: "internal",
      status: "external_providers_disabled",
      recommendation:
        "Use GameValue Price API admin endpoints for manual offers, JSON/CSV imports and internal snapshots. Do not bypass Cloudflare or scrape protected pages."
    },
    { status: 410 }
  );
}
