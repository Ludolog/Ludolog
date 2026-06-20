import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { staticDataMaintenanceService } from "@/lib/services/static-data-maintenance-service";
import { parseJsonBody, staticDataMaintenanceRunSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(staticDataMaintenanceRunSchema, await request.json());
    return NextResponse.json(await staticDataMaintenanceService.run(body.confirm));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Static data maintenance failed." },
      { status: 400 }
    );
  }
}
