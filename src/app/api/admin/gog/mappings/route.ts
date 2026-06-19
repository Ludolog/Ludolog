import { NextResponse } from "next/server";

import { isZodError, requireAdminSecret, zodError } from "@/lib/api";
import { gogService } from "@/lib/services/gog-service";
import { gogMappingSchema, parseJsonBody } from "@/lib/validation";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 100);
  return NextResponse.json({ results: await gogService.listMappings(limit) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = requireAdminSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = parseJsonBody(gogMappingSchema, await request.json());
    return NextResponse.json(await gogService.upsertMapping(body), { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save GOG mapping." }, { status: 500 });
  }
}
