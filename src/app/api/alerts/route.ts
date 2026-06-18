import { NextResponse } from "next/server";

import { isZodError, zodError } from "@/lib/api";
import { alertService } from "@/lib/services/alert-service";
import { parseJsonBody, priceAlertCreateSchema } from "@/lib/validation";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const payload = parseJsonBody(priceAlertCreateSchema, body);
    const alert = await alertService.create(payload.gameId, payload.thresholdPrice);
    const triggered = await alertService.checkAndNotify();

    return NextResponse.json({ alert, triggered }, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return zodError(error);
    }

    return NextResponse.json({ error: "Could not create alert." }, { status: 500 });
  }
}
