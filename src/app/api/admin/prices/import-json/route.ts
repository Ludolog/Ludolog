import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { priceApiService } from "@/lib/services/price-api-service";
import { parseJsonBody, priceImportJsonSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(priceImportJsonSchema, await request.json());
    return NextResponse.json(await priceApiService.importJson(body), { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "JSON price import failed." },
      { status: 500 }
    );
  }
}
