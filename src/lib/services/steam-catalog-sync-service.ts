import { getSteamWebApiKey } from "@/lib/config";
import { mockGameCatalog } from "@/lib/mock-data";
import { repositories } from "@/lib/repositories";
import type { SteamCatalogUpsertInput } from "@/lib/repositories/contracts";

export type SteamCatalogSyncOptions = {
  dryRun?: boolean;
  maxPages?: number;
  maxResults?: number;
  startAfterAppId?: number;
};

export type SteamCatalogSyncResult = {
  dryRun: boolean;
  fetched: number;
  created: number;
  updated: number;
  pages: number;
  lastAppId: number | null;
  hasMore: boolean;
  source: "steam-api" | "mock-fallback";
  warning?: string;
};

type SteamAppListResponse = {
  response?: {
    apps?: Array<{
      appid?: number;
      name?: string;
      app_type?: string;
      last_modified?: number;
      price_change_number?: number;
    }>;
    have_more_results?: boolean;
    last_appid?: number;
  };
};

const defaultPageSize = 1000;
const hardResultLimit = 5000;

export class SteamCatalogSyncService {
  async sync(options: SteamCatalogSyncOptions = {}): Promise<SteamCatalogSyncResult> {
    const dryRun = options.dryRun ?? true;
    const maxPages = clampPositive(options.maxPages ?? 1, 1, 10);
    const maxResults = clampPositive(options.maxResults ?? defaultPageSize, 1, hardResultLimit);
    const catalogStatus =
      options.startAfterAppId === undefined ? await repositories.steamCatalog.status() : null;
    const startAfterAppId =
      options.startAfterAppId === undefined
        ? catalogStatus?.nextStartAfterAppId ?? null
        : clampPositive(options.startAfterAppId, 1, Number.MAX_SAFE_INTEGER);
    const apiKey = getSteamWebApiKey();

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: "info",
      message: `Steam catalog sync started. dryRun=${dryRun}, maxPages=${maxPages}, maxResults=${maxResults}, startAfterAppId=${startAfterAppId ?? "none"}.`
    });

    if (!apiKey) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "steam",
        level: "warning",
        message: "STEAM_WEB_API_KEY is not configured. Steam catalog sync stayed on mock fallback."
      });
      return {
        dryRun,
        fetched: 0,
        created: 0,
        updated: 0,
        pages: 0,
        lastAppId: null,
        hasMore: false,
        source: "mock-fallback",
        warning: "STEAM_WEB_API_KEY is not configured."
      };
    }

    const entries: SteamCatalogUpsertInput[] = [];
    let lastAppId: number | null = startAfterAppId;
    let page = 0;
    let hasMore = true;

    try {
      while (hasMore && page < maxPages && entries.length < maxResults) {
        const pageSize = Math.min(defaultPageSize, maxResults - entries.length);
        const response = await this.fetchPage(apiKey, pageSize, lastAppId);
        const mapped = this.mapSteamApps(response.response?.apps ?? []);
        entries.push(...mapped.slice(0, maxResults - entries.length));
        page += 1;
        hasMore = response.response?.have_more_results === true;
        lastAppId = response.response?.last_appid ?? mapped.at(-1)?.steamAppId ?? lastAppId;
      }

      const result = dryRun ? { created: 0, updated: 0 } : await repositories.steamCatalog.upsertMany(entries);

      await repositories.diagnostics.recordIntegrationLog({
        service: "steam",
        level: "info",
        message: `Steam catalog sync finished. fetched=${entries.length}, created=${result.created}, updated=${result.updated}, dryRun=${dryRun}, hasMore=${hasMore}.`
      });

      return {
        dryRun,
        fetched: entries.length,
        created: result.created,
        updated: result.updated,
        pages: page,
        lastAppId,
        hasMore,
        source: "steam-api"
      };
    } catch (error) {
      await repositories.diagnostics.recordIntegrationLog({
        service: "steam",
        level: "error",
        message: `Steam catalog sync failed after ${entries.length} fetched entries: ${
          error instanceof Error ? error.message : "unknown error"
        }.`
      });
      throw error;
    }
  }

  mapSteamApps(apps: NonNullable<SteamAppListResponse["response"]>["apps"] = []): SteamCatalogUpsertInput[] {
    const now = new Date();

    return apps
      .filter((app) => typeof app.appid === "number" && typeof app.name === "string" && app.name.trim().length > 0)
      .map((app) => ({
        id: `steam-catalog-${app.appid}`,
        steamAppId: app.appid as number,
        title: (app.name as string).trim(),
        appType: app.app_type ?? "game",
        lastModified: app.last_modified ?? null,
        priceChangeNumber: app.price_change_number ?? null,
        isGame: (app.app_type ?? "game") === "game",
        isActive: true,
        source: "steam-api",
        syncedAt: now
      }));
  }

  mockStatusEntries(): SteamCatalogUpsertInput[] {
    const now = new Date();
    return mockGameCatalog.slice(0, 50).map((game) => ({
      id: `steam-catalog-${game.steamAppId}`,
      steamAppId: game.steamAppId,
      title: game.title,
      appType: "game",
      lastModified: null,
      priceChangeNumber: null,
      isGame: true,
      isActive: true,
      source: "mock",
      syncedAt: now
    }));
  }

  private async fetchPage(apiKey: string, maxResults: number, lastAppId: number | null): Promise<SteamAppListResponse> {
    const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("include_games", "true");
    url.searchParams.set("max_results", String(maxResults));
    if (lastAppId !== null) {
      url.searchParams.set("last_appid", String(lastAppId));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Steam catalog API responded with ${response.status}.`);
      }
      return (await response.json()) as SteamAppListResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function clampPositive(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export const steamCatalogSyncService = new SteamCatalogSyncService();
