import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAdminApiSecret, getCronSecret } from "@/lib/config";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function zodError(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    },
    { status: 422 }
  );
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

export async function resolveRouteParams<T>(params: T | Promise<T>): Promise<T> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

export function requireAdminSecret(request: Request): NextResponse | null {
  const expected = getAdminApiSecret();

  if (!expected) {
    return jsonError("ADMIN_API_SECRET is not configured. Manual admin actions are disabled.", 503);
  }

  const provided = request.headers.get("x-admin-secret");
  if (!provided || !constantTimeEqual(provided, expected)) {
    return jsonError("Unauthorized admin action.", 401);
  }

  return null;
}

export function requireCronSecret(request: Request): NextResponse | null {
  const expected = getCronSecret();
  const provided = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || !provided || !constantTimeEqual(provided, expected)) {
    return jsonError("Unauthorized cron action.", 401);
  }

  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
