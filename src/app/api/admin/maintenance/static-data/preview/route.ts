import { NextResponse } from "next/server";

import { requireAdminSecret } from "@/lib/api";
import { staticDataMaintenanceService } from "@/lib/services/static-data-maintenance-service";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json(await staticDataMaintenanceService.preview());
}
