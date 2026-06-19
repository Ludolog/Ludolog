import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { HttpResponse } from "@capacitor/core";
import type {
  ApiAdminStatus,
  ApiGameProfile,
  ApiImportGameResponse,
  ApiStatsOverview,
  BestDealsResponse,
  SearchResponse,
  WatchlistCreateResponse,
  WatchlistResponse
} from "@shared/api-types";

export type Fetcher = typeof fetch;
export type ApiClientErrorType = "http" | "network" | "parse";

export type RuntimeInfo = {
  href: string;
  origin: string;
  platform: string;
  transport: "capacitor-http" | "fetch";
  userAgent: string;
};

type ApiClientTransport = {
  kind: RuntimeInfo["transport"];
  request(path: string, options: RequestOptions): Promise<TransportResponse>;
};

type TransportResponse = {
  data: unknown;
  status: number;
};

export class ApiClientError extends Error {
  baseUrl: string;
  details: string;
  endpoint: string;
  status?: number;
  type: ApiClientErrorType;
  url: string;

  constructor({
    baseUrl,
    details,
    endpoint,
    message,
    status,
    type,
    url
  }: {
    baseUrl: string;
    details?: string;
    endpoint: string;
    message: string;
    status?: number;
    type: ApiClientErrorType;
    url: string;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.baseUrl = baseUrl;
    this.details = details ?? message;
    this.endpoint = endpoint;
    this.status = status;
    this.type = type;
    this.url = url;
  }
}

type RequestOptions = RequestInit & {
  expectedStatus?: number | number[];
};

export const DEFAULT_ANDROID_EMULATOR_API_URL = "http://10.0.2.2:3000";
export const DEFAULT_PRODUCTION_API_URL = "https://apka-seven.vercel.app";

export function getConfiguredApiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const fallback = env?.MODE === "production" ? DEFAULT_PRODUCTION_API_URL : DEFAULT_ANDROID_EMULATOR_API_URL;
  return normalizeBaseUrl(env?.VITE_API_BASE_URL ?? fallback);
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getRuntimeInfo(transportKind = getDefaultTransport().kind): RuntimeInfo {
  return {
    href: globalThis.location?.href ?? "n/a",
    origin: globalThis.location?.origin ?? "n/a",
    platform: Capacitor.getPlatform(),
    transport: transportKind,
    userAgent: globalThis.navigator?.userAgent ?? "n/a"
  };
}

export function describeApiClientError(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return error instanceof Error ? error.message : "Nie udalo sie polaczyc z API.";
  }

  const status = error.status === undefined ? "n/a" : String(error.status);
  return [
    `Typ bledu: ${error.type}`,
    `HTTP status: ${status}`,
    `Base URL: ${error.baseUrl}`,
    `Endpoint: ${error.endpoint}`,
    `URL: ${error.url}`,
    `Szczegoly: ${error.details}`
  ].join(" | ");
}

export function createApiClient(baseUrl: string, transport: ApiClientTransport = getDefaultTransport()) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const expectedStatuses = Array.isArray(options.expectedStatus)
      ? options.expectedStatus
      : [options.expectedStatus ?? 200];
    const url = `${normalizedBaseUrl}${path}`;

    try {
      const response = await transport.request(url, options);

      if (!expectedStatuses.includes(response.status)) {
        const details = errorMessageFromData(response.data, response.status);
        throw new ApiClientError({
          baseUrl: normalizedBaseUrl,
          details,
          endpoint: path,
          message: `HTTP ${response.status}: ${details}`,
          status: response.status,
          type: "http",
          url
        });
      }

      return response.data as T;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      const details = error instanceof Error ? error.message : "Nie udalo sie polaczyc z API.";
      throw new ApiClientError({
        baseUrl: normalizedBaseUrl,
        details,
        endpoint: path,
        message: details,
        type: "network",
        url
      });
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    getRuntimeInfo: () => getRuntimeInfo(transport.kind),
    searchGames: (query: string) => request<SearchResponse>(`/api/games/search?q=${encodeURIComponent(query)}`),
    importGame: (input: { steamAppId?: number; slug?: string }) =>
      request<ApiImportGameResponse>("/api/games/import", {
        method: "POST",
        expectedStatus: [200, 201],
        body: JSON.stringify(input)
      }),
    getGameProfile: (id: string) => request<ApiGameProfile>(`/api/games/${encodeURIComponent(id)}`),
    refreshGamePlayers: (id: string) =>
      request<{ profile: ApiGameProfile | null; snapshot: unknown }>(`/api/games/${encodeURIComponent(id)}/refresh-players`, {
        method: "POST"
      }),
    getBestDeals: (limit = 8) => request<BestDealsResponse>(`/api/deals/best?limit=${limit}`),
    getStatsOverview: () => request<ApiStatsOverview>("/api/stats/overview"),
    getWatchlist: () => request<WatchlistResponse>("/api/watchlist"),
    addToWatchlist: (gameId: string) =>
      request<WatchlistCreateResponse>("/api/watchlist", {
        method: "POST",
        expectedStatus: 201,
        body: JSON.stringify({ gameId })
      }),
    getAdminStatus: () => request<ApiAdminStatus>("/api/admin/status")
  };
}

export function createFetchTransport(fetcher: Fetcher = fetch): ApiClientTransport {
  return {
    kind: "fetch",
    async request(url, options) {
      const response = await fetcher(url, {
        ...options,
        headers: buildFetchHeaders(options)
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new ApiClientError({
          baseUrl: baseUrlFromUrl(url),
          details: parseError instanceof Error ? parseError.message : "Nie udalo sie sparsowac JSON z API.",
          endpoint: endpointFromUrl(url),
          message: "Nie udalo sie sparsowac JSON z API.",
          type: "parse",
          url
        });
      }

      return {
        data,
        status: response.status
      };
    }
  };
}

export function createCapacitorHttpTransport(http: Pick<typeof CapacitorHttp, "request"> = CapacitorHttp): ApiClientTransport {
  return {
    kind: "capacitor-http",
    async request(url, options) {
      const response = await http.request({
        data: parseRequestBody(options.body),
        headers: buildPlainHeaders(options),
        method: options.method ?? "GET",
        responseType: "json",
        url
      });

      return {
        data: normalizeCapacitorData(response),
        status: response.status
      };
    }
  };
}

function getDefaultTransport(): ApiClientTransport {
  return Capacitor.isNativePlatform() ? createCapacitorHttpTransport() : createFetchTransport();
}

function buildFetchHeaders(options: RequestOptions): HeadersInit {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function buildPlainHeaders(options: RequestOptions): Record<string, string> {
  const headers = new Headers(buildFetchHeaders(options));
  const plainHeaders: Record<string, string> = {};

  headers.forEach((value, key) => {
    plainHeaders[key] = value;
  });

  return plainHeaders;
}

function parseRequestBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") {
    return body;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function normalizeCapacitorData(response: HttpResponse): unknown {
  if (typeof response.data !== "string") {
    return response.data;
  }

  try {
    return JSON.parse(response.data) as unknown;
  } catch (error) {
    throw new ApiClientError({
      baseUrl: baseUrlFromUrl(response.url),
      details: error instanceof Error ? error.message : "Nie udalo sie sparsowac JSON z API.",
      endpoint: endpointFromUrl(response.url),
      message: "Nie udalo sie sparsowac JSON z API.",
      type: "parse",
      url: response.url
    });
  }
}

function errorMessageFromData(data: unknown, status: number): string {
  if (isRecord(data) && typeof data.error === "string") {
    return data.error;
  }

  return `API returned status ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function endpointFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function baseUrlFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return "n/a";
  }
}

export const apiClient = createApiClient(getConfiguredApiBaseUrl());
