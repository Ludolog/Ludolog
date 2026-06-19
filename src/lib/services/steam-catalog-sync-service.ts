import { getSteamWebApiKey } from "@/lib/config";
import { mockGameCatalog } from "@/lib/mock-data";
import { repositories } from "@/lib/repositories";
import type { SteamCatalogUpsertInput } from "@/lib/repositories/contracts";
import type {
  ApiSteamCatalogSyncUntilBatch,
  ApiSteamCatalogSyncUntilRequest,
  ApiSteamCatalogSyncUntilResponse
} from "@shared/api-types";

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

export type SteamCatalogSyncUntilOptions = ApiSteamCatalogSyncUntilRequest;

export type SteamCatalogSyncUntilResult = ApiSteamCatalogSyncUntilResponse;

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

  async syncUntil(options: SteamCatalogSyncUntilOptions): Promise<SteamCatalogSyncUntilResult> {
    const targetCount = clampPositive(options.targetCount, 1, 100_000);
    const batchSize = clampPositive(options.batchSize ?? 500, 1, 1000);
    const maxBatches = clampPositive(options.maxBatches ?? 4, 1, 20);
    const dryRun = options.dryRun ?? true;
    const initialStatus = await repositories.steamCatalog.status();
    const initialCount = initialStatus.entryCount;
    let finalCount = initialCount;
    let estimatedFinalCount = initialCount;
    let cursor = initialStatus.nextStartAfterAppId;
    let lastAppId: number | null = cursor;
    let hasMore = true;
    let fetched = 0;
    let created = 0;
    let updated = 0;
    let reason: SteamCatalogSyncUntilResult["reason"] | null = null;
    const batches: ApiSteamCatalogSyncUntilBatch[] = [];

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: "info",
      message: `Steam catalog sync-until started. dryRun=${dryRun}, targetCount=${targetCount}, batchSize=${batchSize}, maxBatches=${maxBatches}.`
    });

    if (initialCount >= targetCount) {
      reason = "target-reached";
    }

    while (reason === null && batches.length < maxBatches) {
      const countBeforeBatch = dryRun ? estimatedFinalCount : finalCount;
      const syncOptions: SteamCatalogSyncOptions = {
        dryRun,
        maxPages: 1,
        maxResults: batchSize
      };
      if (cursor !== null) {
        syncOptions.startAfterAppId = cursor;
      }

      const batchResult = await this.sync(syncOptions);
      fetched += batchResult.fetched;
      created += batchResult.created;
      updated += batchResult.updated;
      lastAppId = batchResult.lastAppId;
      hasMore = batchResult.hasMore;

      if (dryRun) {
        estimatedFinalCount += batchResult.fetched;
      } else {
        finalCount = (await repositories.steamCatalog.status()).entryCount;
        estimatedFinalCount = finalCount;
      }

      const countAfterBatch = dryRun ? estimatedFinalCount : finalCount;
      batches.push({
        batch: batches.length + 1,
        dryRun,
        fetched: batchResult.fetched,
        created: batchResult.created,
        updated: batchResult.updated,
        pages: batchResult.pages,
        lastAppId: batchResult.lastAppId,
        hasMore: batchResult.hasMore,
        source: batchResult.source,
        countAfterBatch
      });

      cursor = batchResult.lastAppId;

      if (batchResult.source === "mock-fallback") {
        reason = "mock-fallback";
      } else if (countAfterBatch >= targetCount) {
        reason = "target-reached";
      } else if (!batchResult.hasMore) {
        reason = "steam-end-reached";
      } else if (batchResult.fetched === 0 || countAfterBatch <= countBeforeBatch) {
        reason = "no-progress";
      }
    }

    if (reason === null) {
      reason = "max-batches-reached";
    }

    if (!dryRun) {
      finalCount = (await repositories.steamCatalog.status()).entryCount;
      estimatedFinalCount = finalCount;
    }

    const response: SteamCatalogSyncUntilResult = {
      dryRun,
      targetCount,
      initialCount,
      finalCount,
      estimatedFinalCount,
      batchSize,
      maxBatches,
      batchesRun: batches.length,
      fetched,
      created,
      updated,
      completed: dryRun ? estimatedFinalCount >= targetCount : finalCount >= targetCount,
      reason,
      lastAppId,
      hasMore,
      batches
    };

    await repositories.diagnostics.recordIntegrationLog({
      service: "steam",
      level: response.completed ? "info" : "warning",
      message: `Steam catalog sync-until finished. dryRun=${dryRun}, targetCount=${targetCount}, finalCount=${finalCount}, estimatedFinalCount=${estimatedFinalCount}, batchesRun=${batches.length}, reason=${reason}.`
    });

    return response;
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
