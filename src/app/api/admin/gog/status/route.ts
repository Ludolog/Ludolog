import { NextResponse } from "next/server";

import { gogService } from "@/lib/services/gog-service";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await gogService.status());
}
