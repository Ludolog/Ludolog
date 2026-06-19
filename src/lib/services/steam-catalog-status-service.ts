import { getDataMode, getSteamWebApiKey } from "@/lib/config";
import { repositories } from "@/lib/repositories";
import type { SteamCatalogRuntimeStatus } from "@/lib/types";

export class SteamCatalogStatusService {
  async getStatus(): Promise<SteamCatalogRuntimeStatus> {
    const [catalog, logs] = await Promise.all([
      repositories.steamCatalog.status(),
      repositories.diagnostics.listIntegrationLogs(12)
    ]);
    const steamLogs = logs.filter((log) => log.service === "steam" || log.service === "search");
    const dataMode = getDataMode();
    const hasSteamApiKey = getSteamWebApiKey() !== undefined;

    return {
      steamCatalogEntryCount: catalog.entryCount,
      activeGameCount: catalog.activeGameCount,
      catalogCompleteness: resolveCatalogCompleteness(catalog.entryCount, steamLogs),
      fetchedTotal: catalog.entryCount,
      lastSteamCatalogSync: catalog.lastSyncedAt,
      nextSteamCatalogStartAfterAppId: catalog.nextStartAfterAppId,
      lastSteamCatalogError: steamLogs.find((log) => log.level === "error") ?? null,
      hasSteamApiKey,
      dataMode,
      canUseRealSteamApi: dataMode === "api" && hasSteamApiKey,
      integrationLogs: steamLogs
    };
  }
}

function resolveCatalogCompleteness(
  entryCount: number,
  logs: Awaited<ReturnType<typeof repositories.diagnostics.listIntegrationLogs>>
): "partial" | "full" | "unknown" {
  if (entryCount <= 0) {
    return "unknown";
  }

  const latestFinish = logs.find(
    (log) => log.service === "steam" && log.message.startsWith("Steam catalog sync finished.")
  );

  if (latestFinish?.message.includes("hasMore=false")) {
    return "full";
  }

  return "partial";
}

export const steamCatalogStatusService = new SteamCatalogStatusService();
