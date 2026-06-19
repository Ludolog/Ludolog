import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { priceProviderService } from "@/lib/services/price-provider-service";
import { parseJsonBody, priceProviderDiagnosticsSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(priceProviderDiagnosticsSchema, await request.json());
    return NextResponse.json(await priceProviderService.diagnoseProvider(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Price provider diagnostics failed." },
      { status: 500 }
    );
  }
}
