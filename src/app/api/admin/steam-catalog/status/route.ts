import { NextResponse } from "next/server";

import { repositories } from "@/lib/repositories";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await repositories.steamCatalog.status());
}
