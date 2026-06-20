import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { gogService } from "@/lib/services/gog-service";
import { gogMappingApproveSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(gogMappingApproveSchema, await request.json());
    return NextResponse.json(await gogService.approveMapping(body), { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not approve GOG mapping." }, { status: 500 });
  }
}
