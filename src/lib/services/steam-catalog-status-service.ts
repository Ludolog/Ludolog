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
      lastSteamCatalogSync: catalog.lastSyncedAt,
      lastSteamCatalogError: steamLogs.find((log) => log.level === "error") ?? null,
      hasSteamApiKey,
      dataMode,
      canUseRealSteamApi: dataMode === "api" && hasSteamApiKey,
      integrationLogs: steamLogs
    };
  }
}

export const steamCatalogStatusService = new SteamCatalogStatusService();
