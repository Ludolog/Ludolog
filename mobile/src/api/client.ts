import type {
  ApiAdminStatus,
  ApiGameProfile,
  BestDealsResponse,
  SearchResponse,
  WatchlistCreateResponse,
  WatchlistResponse
} from "@shared/api-types";

export type Fetcher = typeof fetch;

export class ApiClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  expectedStatus?: number;
};

export const DEFAULT_ANDROID_EMULATOR_API_URL = "http://10.0.2.2:3000";
export const DEFAULT_PRODUCTION_API_URL = "https://gamevalue-radar.vercel.app";

export function getConfiguredApiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const fallback = env?.MODE === "production" ? DEFAULT_PRODUCTION_API_URL : DEFAULT_ANDROID_EMULATOR_API_URL;
  return normalizeBaseUrl(env?.VITE_API_BASE_URL ?? fallback);
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function createApiClient(baseUrl: string, fetcher: Fetcher = fetch) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const expectedStatus = options.expectedStatus ?? 200;

    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers
        }
      });

      if (response.status !== expectedStatus) {
        const message = await safeErrorMessage(response);
        throw new ApiClientError(message, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      throw new ApiClientError(
        "Nie można połączyć się z backendem. Sprawdź API_BASE_URL oraz czy Next.js działa na porcie 3000."
      );
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

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `API zwróciło status ${response.status}.`;
  } catch {
    return `API zwróciło status ${response.status}.`;
  }
}

export const apiClient = createApiClient(getConfiguredApiBaseUrl());
