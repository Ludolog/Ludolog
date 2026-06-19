import { NextResponse } from "next/server";

import { categoryRankingService } from "@/lib/services/category-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const category = await categoryRankingService.details(slug, Number.isFinite(limit) ? limit : 50);

  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json(category);
}
