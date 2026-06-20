import type { GGDealsErrorType, GGDealsProviderStatus } from "@shared/api-types";

import type { IntegrationLog } from "@/lib/types";

export type GGDealsResponseClassification = {
  responseKind: "json" | "html" | "text" | "empty";
  cloudflareDetected: boolean;
  apiErrorDetected: boolean;
  errorType: GGDealsErrorType | null;
  providerStatus: GGDealsProviderStatus;
  message: string;
  safePreview: string | null;
};

export const GGDEALS_DEFAULT_API_BASE_URL = "https://gg.deals/api/prices/by-steam-app-id/";

const GGDEALS_API_CANDIDATE_URLS = [
  GGDEALS_DEFAULT_API_BASE_URL,
  "https://api.gg.deals/api/prices/by-steam-app-id/",
  "https://api.gg.deals/prices/by-steam-app-id/"
];

export function ggDealsDiagnosticBaseUrls(configuredBaseUrl: string): string[] {
  return uniqueStrings([configuredBaseUrl, ...GGDEALS_API_CANDIDATE_URLS]);
}

export function classifyGGDealsResponse({
  body,
  contentType,
  ok,
  status
}: {
  body: string;
  contentType: string | null;
  ok: boolean;
  status: number;
}): GGDealsResponseClassification {
  const trimmed = body.trim();
  const lowerBody = trimmed.toLowerCase();
  const lowerContentType = (contentType ?? "").toLowerCase();
  const responseKind = detectResponseKind(trimmed, lowerContentType);
  const cloudflareDetected =
    responseKind === "html" &&
    (lowerBody.includes("just a moment") ||
      lowerBody.includes("cloudflare") ||
      lowerBody.includes("cf-chl") ||
      lowerBody.includes("cdn-cgi/challenge"));
  const apiErrorDetected =
    responseKind === "json" &&
    !ok &&
    (lowerBody.includes("api") || lowerBody.includes("key") || lowerBody.includes("unauthorized"));

  if (ok && responseKind === "json") {
    return {
      responseKind,
      cloudflareDetected,
      apiErrorDetected,
      errorType: null,
      providerStatus: "ok",
      message: "GG.deals API returned JSON.",
      safePreview: safeJsonPreview(trimmed)
    };
  }

  if (cloudflareDetected) {
    return {
      responseKind,
      cloudflareDetected,
      apiErrorDetected,
      errorType: "blocked_by_cloudflare",
      providerStatus: "blocked_by_cloudflare",
      message: "GG.deals returned a Cloudflare challenge instead of API JSON.",
      safePreview: null
    };
  }

  if (status === 401 || (status === 403 && responseKind === "json" && apiErrorDetected)) {
    return {
      responseKind,
      cloudflareDetected,
      apiErrorDetected,
      errorType: "invalid_api_key",
      providerStatus: "invalid_key",
      message: "GG.deals rejected the API key or account permissions.",
      safePreview: safeJsonPreview(trimmed)
    };
  }

  if (responseKind !== "json") {
    return {
      responseKind,
      cloudflareDetected,
      apiErrorDetected,
      errorType: "invalid_json_response",
      providerStatus: "invalid_response",
      message: `GG.deals returned ${responseKind} instead of API JSON.`,
      safePreview: responseKind === "html" ? null : safeTextPreview(trimmed)
    };
  }

  return {
    responseKind,
    cloudflareDetected,
    apiErrorDetected,
    errorType: "api_http_error",
    providerStatus: "api_error",
    message: `GG.deals API returned HTTP ${status}.`,
    safePreview: safeJsonPreview(trimmed)
  };
}

export function ggDealsStatusFromErrorType(errorType: GGDealsErrorType): GGDealsProviderStatus {
  if (errorType === "missing_api_key") {
    return "missing_key";
  }
  if (errorType === "blocked_by_cloudflare") {
    return "blocked_by_cloudflare";
  }
  if (errorType === "invalid_api_key") {
    return "invalid_key";
  }
  if (errorType === "invalid_json_response") {
    return "invalid_response";
  }
  if (errorType === "no_price_data") {
    return "no_price_data";
  }
  if (errorType === "network_error") {
    return "network_error";
  }
  if (errorType === "timeout") {
    return "timeout";
  }
  return "api_error";
}

export function ggDealsMessageForErrorType(errorType: GGDealsErrorType): string {
  if (errorType === "blocked_by_cloudflare") {
    return "GG.deals blocked the server request with a Cloudflare challenge. Keep GG.deals disabled and use GameValue-controlled price sources until GG.deals provides an API-safe endpoint for this hosting origin.";
  }
  if (errorType === "invalid_api_key") {
    return "GG.deals rejected the API key or account permissions.";
  }
  if (errorType === "invalid_json_response") {
    return "GG.deals did not return API JSON.";
  }
  if (errorType === "no_price_data") {
    return "GG.deals returned JSON but no usable price offers for this Steam App ID.";
  }
  if (errorType === "network_error") {
    return "The backend could not reach GG.deals.";
  }
  if (errorType === "timeout") {
    return "The GG.deals request timed out.";
  }
  if (errorType === "missing_api_key") {
    return "GGDEALS_API_KEY is missing on the backend.";
  }
  return "GG.deals returned an API error.";
}

export function ggDealsRecommendation(status: GGDealsProviderStatus): string {
  if (status === "ok") {
    return "GG.deals API returned usable JSON. Keep the backend-only key in Vercel and run a dry run before real writes.";
  }
  if (status === "blocked_by_cloudflare") {
    return "Contact GG.deals support with the sanitized diagnostic details and ask for API access that works from Vercel/serverless infrastructure. Do not bypass Cloudflare with browser sessions, cookies or scraping.";
  }
  if (status === "missing_key") {
    return "Set GGDEALS_API_KEY only in backend/server environment variables and redeploy.";
  }
  if (status === "invalid_key") {
    return "Check that the GG.deals key is valid and that the account has API access for the documented prices endpoint.";
  }
  if (status === "invalid_response") {
    return "Verify GGDEALS_API_BASE_URL against the GG.deals documentation. The backend expected JSON and received a different response.";
  }
  if (status === "no_price_data") {
    return "Try a different Steam App ID or confirm whether this app has price data in GG.deals.";
  }
  return "Keep legacy provider writes disabled and inspect the latest sanitized diagnostic log before considering any future provider change.";
}

export function maskSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of ["key", "apiKey", "apikey", "token", "secret"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "redacted");
      }
    }
    return url.toString();
  } catch {
    return value.replace(/([?&](?:key|apiKey|apikey|token|secret)=)[^&]+/gi, "$1redacted");
  }
}

export function resolveGGDealsStatusFromLogs({
  hasApiKey,
  logs,
  realOffers,
  realPriceSnapshots
}: {
  hasApiKey: boolean;
  logs: IntegrationLog[];
  realOffers: number;
  realPriceSnapshots: number;
}): { status: GGDealsProviderStatus; lastCheckedAt: Date | null } {
  if (!hasApiKey) {
    return { status: "missing_key", lastCheckedAt: null };
  }

  const latest = logs.find((log) => log.service === "ggdeals") ?? null;
  if (!latest) {
    return { status: realOffers > 0 || realPriceSnapshots > 0 ? "ok" : "not_configured", lastCheckedAt: null };
  }

  return {
    status: statusFromMessage(latest.message, latest.level, realOffers, realPriceSnapshots),
    lastCheckedAt: latest.createdAt
  };
}

function statusFromMessage(
  message: string,
  level: IntegrationLog["level"],
  realOffers: number,
  realPriceSnapshots: number
): GGDealsProviderStatus {
  if (message.includes("providerStatus=ok") || message.includes("status=ok")) {
    return "ok";
  }
  if (message.includes("blocked_by_cloudflare")) {
    return "blocked_by_cloudflare";
  }
  if (message.includes("invalid_api_key") || message.includes("providerStatus=invalid_key")) {
    return "invalid_key";
  }
  if (message.includes("invalid_json_response") || message.includes("providerStatus=invalid_response")) {
    return "invalid_response";
  }
  if (message.includes("no_price_data")) {
    return "no_price_data";
  }
  if (message.includes("network_error")) {
    return "network_error";
  }
  if (message.includes("timeout")) {
    return "timeout";
  }
  if (level === "warning" || level === "error") {
    return "api_error";
  }
  return realOffers > 0 || realPriceSnapshots > 0 ? "ok" : "not_configured";
}

function detectResponseKind(body: string, contentType: string): GGDealsResponseClassification["responseKind"] {
  if (!body) {
    return "empty";
  }
  if (contentType.includes("json") || body.startsWith("{") || body.startsWith("[")) {
    return "json";
  }
  if (contentType.includes("html") || body.toLowerCase().includes("<html")) {
    return "html";
  }
  return "text";
}

function safeJsonPreview(body: string): string | null {
  if (!body) {
    return null;
  }
  return safeTextPreview(maskSensitiveUrl(body));
}

function safeTextPreview(body: string): string | null {
  const preview = body.replace(/\s+/g, " ").trim().slice(0, 180);
  return preview.length > 0 ? preview : null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
