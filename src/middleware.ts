import { NextRequest, NextResponse } from "next/server";

const devAllowedOrigins = [
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://10.0.2.2:5173"
];

function configuredOrigins(): string[] {
  const configured = process.env.MOBILE_ALLOWED_ORIGINS;
  if (configured?.trim()) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === "production") {
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
    return [process.env.NEXT_PUBLIC_APP_URL ?? "", vercelUrl, "capacitor://localhost"].filter(Boolean);
  }

  return devAllowedOrigins;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = configuredOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : "";

  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

export function middleware(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*"
};
