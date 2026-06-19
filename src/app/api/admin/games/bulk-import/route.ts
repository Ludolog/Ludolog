import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { bulkImportService } from "@/lib/services/bulk-import-service";
import { adminBulkImportSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(adminBulkImportSchema, await request.json());
    return NextResponse.json(await bulkImportService.importGames(body));
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk import failed." },
      { status: 500 }
    );
  }
}
