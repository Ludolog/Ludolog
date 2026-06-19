import type {
  ApiAdminStatus,
  ApiGameProfile,
  BestDealsResponse,
  SearchResponse,
  WatchlistCreateResponse,
  WatchlistResponse
} from "@shared/api-types";

export type Fetcher = typeof fetch;
export type ApiClientErrorType = "http" | "network" | "parse";

export class ApiClientError extends Error {
  baseUrl: string;
  endpoint: string;
  status?: number;
  type: ApiClientErrorType;
  url: string;

  constructor({
    baseUrl,
    endpoint,
    message,
    status,
    type,
    url
  }: {
    baseUrl: string;
    endpoint: string;
    message: string;
    status?: number;
    type: ApiClientErrorType;
    url: string;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.baseUrl = baseUrl;
    this.endpoint = endpoint;
    this.status = status;
    this.type = type;
    this.url = url;
  }
}

type RequestOptions = RequestInit & {
  expectedStatus?: number;
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
    `Szczegoly: ${error.message}`
  ].join(" | ");
}

export function createApiClient(baseUrl: string, fetcher: Fetcher = fetch) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const expectedStatus = options.expectedStatus ?? 200;
    const url = `${normalizedBaseUrl}${path}`;

    try {
      const response = await fetcher(url, {
        ...options,
        headers: buildHeaders(options)
      });

      if (response.status !== expectedStatus) {
        const message = await safeErrorMessage(response);
        throw new ApiClientError({
          baseUrl: normalizedBaseUrl,
          endpoint: path,
          message: `HTTP ${response.status}: ${message}`,
          status: response.status,
          type: "http",
          url
        });
      }

      try {
        return (await response.json()) as T;
      } catch (parseError) {
        throw new ApiClientError({
          baseUrl: normalizedBaseUrl,
          endpoint: path,
          message: parseError instanceof Error ? parseError.message : "Nie udalo sie sparsowac JSON z API.",
          type: "parse",
          url
        });
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      throw new ApiClientError({
        baseUrl: normalizedBaseUrl,
        endpoint: path,
        message: error instanceof Error ? error.message : "Nie udalo sie polaczyc z API.",
        type: "network",
        url
      });
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    searchGames: (query: string) => request<SearchResponse>(`/api/games/search?q=${encodeURIComponent(query)}`),
    getGameProfile: (id: string) => request<ApiGameProfile>(`/api/games/${encodeURIComponent(id)}`),
    getBestDeals: (limit = 8) => request<BestDealsResponse>(`/api/deals/best?limit=${limit}`),
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

function buildHeaders(options: RequestOptions): HeadersInit {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `API returned status ${response.status}.`;
  } catch {
    return `API returned status ${response.status}.`;
  }
}

export const apiClient = createApiClient(getConfiguredApiBaseUrl());
