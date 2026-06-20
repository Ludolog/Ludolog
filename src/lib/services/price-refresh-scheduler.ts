import {
  getPriceRefreshCatalogBackfillLimit,
  getPriceRefreshGogLimit,
  getPriceRefreshImportedLimit,
  getPriceRefreshMaxRuntimeMs,
  getPriceRefreshSteamStoreLimit,
  isPriceRefreshCatalogBackfillEnabled,
  isPriceRefreshEnabled
} from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { gogService } from "@/lib/services/gog-service";
import { steamStorePriceService } from "@/lib/services/steam-store-price-service";
import type {
  ApiAutomationSourceReport,
  ApiGogPriceRefreshResponse,
  ApiPriceRefreshAutomationResponse,
  ApiSteamStorePriceRefreshResponse
} from "@shared/api-types";

export type PriceRefreshSchedulerOptions = {
  dryRun?: boolean;
  mode?: "scheduled" | "manual" | "catalog-backfill";
  includeCatalogBackfill?: boolean;
};

export class PriceRefreshScheduler {
  async refresh(options: PriceRefreshSchedulerOptions = {}): Promise<ApiPriceRefreshAutomationResponse> {
    const startedAt = new Date();
    const dryRun = options.dryRun ?? true;
    const enabled = isPriceRefreshEnabled();
    const deadlineAt = startedAt.getTime() + getPriceRefreshMaxRuntimeMs();
    const reports: ApiAutomationSourceReport[] = [];
    const errors: Array<{ input: string; message: string }> = [];

    if (enabled) {
      await this.runSource(reports, errors, deadlineAt, () =>
        steamStorePriceService.refreshPrices({
          mode: "imported",
          limit: Math.min(getPriceRefreshImportedLimit(), getPriceRefreshSteamStoreLimit()),
          dryRun
        }).then((result) => steamStoreReport("imported", result))
      );

      await this.runSource(reports, errors, deadlineAt, () =>
        gogService.refreshPrices({
          mode: "mapped-games",
          limit: getPriceRefreshGogLimit(),
          dryRun
        }).then((result) => gogReport("mapped-games", result))
      );

      if (options.includeCatalogBackfill ?? isPriceRefreshCatalogBackfillEnabled()) {
        await this.runSource(reports, errors, deadlineAt, () =>
          steamStorePriceService.refreshPrices({
            mode: "catalog-backfill",
            limit: getPriceRefreshCatalogBackfillLimit(),
            dryRun
          }).then((result) => steamStoreReport("catalog-backfill", result))
        );
      }
    }

    const finishedAt = new Date();
    const response = aggregateReports({
      mode: options.mode ?? "scheduled",
      dryRun,
      enabled,
      startedAt,
      finishedAt,
      reports,
      errors
    });

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: response.failed > 0 ? "warning" : "info",
      message: `Price refresh scheduler finished. mode=${response.mode}, dryRun=${dryRun}, enabled=${enabled}, requested=${response.requested}, refreshed=${response.refreshed}, failed=${response.failed}, durationMs=${response.durationMs}.`
    });

    return response;
  }

  async backfillCatalog(options: { dryRun?: boolean } = {}): Promise<ApiPriceRefreshAutomationResponse> {
    const startedAt = new Date();
    const dryRun = options.dryRun ?? true;
    const enabled = isPriceRefreshEnabled();
    const deadlineAt = startedAt.getTime() + getPriceRefreshMaxRuntimeMs();
    const reports: ApiAutomationSourceReport[] = [];
    const errors: Array<{ input: string; message: string }> = [];

    if (enabled) {
      await this.runSource(reports, errors, deadlineAt, () =>
        steamStorePriceService.refreshPrices({
          mode: "catalog-backfill",
          limit: getPriceRefreshCatalogBackfillLimit(),
          dryRun
        }).then((result) => steamStoreReport("catalog-backfill", result))
      );
    }

    const finishedAt = new Date();
    const response = aggregateReports({
      mode: "catalog-backfill",
      dryRun,
      enabled,
      startedAt,
      finishedAt,
      reports,
      errors
    });

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: response.failed > 0 ? "warning" : "info",
      message: `Catalog price backfill scheduler finished. dryRun=${dryRun}, enabled=${enabled}, requested=${response.requested}, refreshed=${response.refreshed}, failed=${response.failed}, durationMs=${response.durationMs}.`
    });

    return response;
  }

  private async runSource(
    reports: ApiAutomationSourceReport[],
    errors: Array<{ input: string; message: string }>,
    deadlineAt: number,
    run: () => Promise<ApiAutomationSourceReport>
  ): Promise<void> {
    if (Date.now() > deadlineAt) {
      errors.push({ input: "scheduler", message: "Price refresh scheduler stopped at max runtime." });
      return;
    }
    try {
      reports.push(await run());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Price refresh source failed.";
      errors.push({ input: "source", message });
    }
  }
}

function steamStoreReport(mode: string, response: ApiSteamStorePriceRefreshResponse): ApiAutomationSourceReport {
  return {
    source: "steam-store",
    mode,
    dryRun: response.dryRun,
    requested: response.requested,
    refreshed: response.refreshed,
    skipped: response.skipped,
    skippedFreshCache: response.skippedFreshCache ?? 0,
    skippedNoMapping: 0,
    skippedNoPrice: response.skippedNoPrice ?? 0,
    failed: response.failed,
    createdOffers: response.createdOffers ?? 0,
    updatedOffers: response.updatedOffers ?? 0,
    createdSnapshots: response.createdSnapshots ?? 0,
    errors: response.errors.map((error) => ({ input: String(error.steamAppId), message: error.message })),
    startedAt: response.startedAt ?? new Date().toISOString(),
    finishedAt: response.finishedAt ?? new Date().toISOString(),
    durationMs: response.durationMs ?? 0
  };
}

function gogReport(mode: string, response: ApiGogPriceRefreshResponse): ApiAutomationSourceReport {
  return {
    source: "gog",
    mode,
    dryRun: response.dryRun,
    requested: response.requested,
    refreshed: response.refreshed,
    skipped: response.skipped,
    skippedFreshCache: response.skippedFreshCache ?? 0,
    skippedNoMapping: response.skippedNoMapping ?? 0,
    skippedNoPrice: 0,
    failed: response.failed,
    createdOffers: response.dryRun ? 0 : response.refreshed,
    updatedOffers: 0,
    createdSnapshots: response.dryRun ? 0 : response.refreshed,
    errors: response.errors.map((error) => ({ input: error.gogProductId ?? error.gameId, message: error.message })),
    startedAt: response.startedAt ?? new Date().toISOString(),
    finishedAt: response.finishedAt ?? new Date().toISOString(),
    durationMs: response.durationMs ?? 0
  };
}

function aggregateReports(input: {
  mode: ApiPriceRefreshAutomationResponse["mode"];
  dryRun: boolean;
  enabled: boolean;
  startedAt: Date;
  finishedAt: Date;
  reports: ApiAutomationSourceReport[];
  errors: Array<{ input: string; message: string }>;
}): ApiPriceRefreshAutomationResponse {
  const sum = (selector: (report: ApiAutomationSourceReport) => number) =>
    input.reports.reduce((total, report) => total + selector(report), 0);
  const errors = [...input.errors, ...input.reports.flatMap((report) => report.errors)];
  return {
    source: "price-refresh",
    mode: input.mode,
    dryRun: input.dryRun,
    enabled: input.enabled,
    requested: sum((report) => report.requested),
    refreshed: sum((report) => report.refreshed),
    skipped: sum((report) => report.skipped),
    skippedFreshCache: sum((report) => report.skippedFreshCache),
    skippedNoMapping: sum((report) => report.skippedNoMapping),
    skippedNoPrice: sum((report) => report.skippedNoPrice),
    failed: input.errors.length + sum((report) => report.failed),
    createdOffers: sum((report) => report.createdOffers),
    updatedOffers: sum((report) => report.updatedOffers),
    createdSnapshots: sum((report) => report.createdSnapshots),
    errors,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    reports: input.reports
  };
}

export const priceRefreshScheduler = new PriceRefreshScheduler();
