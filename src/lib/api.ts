import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
