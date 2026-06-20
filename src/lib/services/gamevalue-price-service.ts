import { getPriceMode, getPriceProvider, areLegacyPriceProvidersEnabled } from "@/lib/config";
import { repositories } from "@/lib/repositories";
import { trustedOffersOnly } from "@/lib/services/price-source-utils";
import type { Game, GamePriceSnapshot, PriceSource, PriceSourceType, Store, StoreOffer, StoreType } from "@/lib/types";
import type {
  ApiManualOfferRequest,
  ApiPriceImportCsvRequest,
  ApiPriceImportJsonRequest,
  ApiPriceIngestionResponse,
  ApiPriceIngestionResult,
  ApiPriceSnapshotRequest,
  ApiPricesStatus
} from "@shared/api-types";

type NormalizedInternalOffer = Required<Pick<ApiManualOfferRequest, "steamAppId" | "storeName" | "price">> &
  Omit<ApiManualOfferRequest, "steamAppId" | "storeName" | "price"> & {
    sourceName: string;
    sourceType: PriceSourceType;
  };

export class GameValuePriceService {
  async status(): Promise<ApiPricesStatus> {
    const status = await repositories.prices.status();
    return {
      provider: getPriceProvider(),
      mode: getPriceMode(),
      externalProvidersEnabled: areLegacyPriceProvidersEnabled(),
      offerCount: status.offerCount,
      priceSnapshotCount: status.priceSnapshotCount,
      storeCount: status.storeCount,
      priceSourceCount: status.priceSourceCount,
      lastPriceSnapshot: status.lastPriceSnapshot?.toISOString() ?? null,
      realInternalPriceSnapshots: status.realInternalPriceSnapshots,
      mockPriceSnapshots: status.mockPriceSnapshots,
      realOffers: status.realOffers,
      mockOffers: status.mockOffers,
      steamStoreOfferCount: status.steamStoreOfferCount,
      steamStorePriceSnapshotCount: status.steamStorePriceSnapshotCount,
      catalogStoreOfferCount: status.catalogStoreOfferCount
    };
  }

  async addManualOffer(input: ApiManualOfferRequest): Promise<ApiPriceIngestionResponse> {
    return this.ingestOffers([{ ...input, sourceName: input.sourceName ?? "manual-admin", sourceType: "manual" }], {
      sourceName: input.sourceName ?? "manual-admin",
      sourceType: "manual"
    });
  }

  async importJson(input: ApiPriceImportJsonRequest): Promise<ApiPriceIngestionResponse> {
    return this.ingestOffers(
      input.offers.map((offer) => ({ ...offer, sourceName: input.sourceName, sourceType: "json" })),
      { sourceName: input.sourceName, sourceType: "json" }
    );
  }

  async importCsv(input: ApiPriceImportCsvRequest): Promise<ApiPriceIngestionResponse> {
    return this.ingestOffers(parseCsvOffers(input.csv, input.sourceName), {
      sourceName: input.sourceName,
      sourceType: "csv"
    });
  }

  async snapshot(input: ApiPriceSnapshotRequest): Promise<ApiPriceIngestionResponse> {
    const game = await repositories.games.findBySteamAppId(input.steamAppId);
    if (!game) {
      return emptyResponse(1, {
        input: String(input.steamAppId),
        message: "Game is not imported yet."
      });
    }

    const sourceResult = await repositories.prices.upsertPriceSource({
      name: input.sourceName ?? "manual-admin",
      type: "manual"
    });
    const snapshot = await this.appendSnapshot(game, sourceResult.source);

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: "info",
      message: `GameValue price snapshot stored. steamAppId=${game.steamAppId}, gameId=${game.id}, source=${sourceResult.source.name}.`
    });

    return {
      provider: "gamevalue",
      mode: "internal",
      requested: 1,
      stored: snapshot ? 1 : 0,
      skipped: snapshot ? 0 : 1,
      failed: 0,
      errors: [],
      results: [
        {
          input: String(game.steamAppId),
          gameId: game.id,
          steamAppId: game.steamAppId,
          title: game.title,
          createdStore: false,
          createdSource: sourceResult.created,
          offerId: null,
          snapshotId: snapshot?.id ?? null,
          skipped: snapshot === null,
          message: snapshot ? null : "No available offers for this game."
        }
      ]
    };
  }

  async recalculate(): Promise<ApiPriceIngestionResponse> {
    const games = await repositories.games.list();
    const sourceResult = await repositories.prices.upsertPriceSource({ name: "manual-admin", type: "manual" });
    const results: ApiPriceIngestionResult[] = [];
    let stored = 0;
    let skipped = 0;

    for (const game of games) {
      const snapshot = await this.appendSnapshot(game, sourceResult.source);
      if (snapshot) {
        stored += 1;
      } else {
        skipped += 1;
      }
      results.push({
        input: String(game.steamAppId),
        gameId: game.id,
        steamAppId: game.steamAppId,
        title: game.title,
        createdStore: false,
        createdSource: sourceResult.created,
        offerId: null,
        snapshotId: snapshot?.id ?? null,
        skipped: snapshot === null,
        message: snapshot ? null : "No available offers for this game."
      });
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: "info",
      message: `GameValue price recalculation finished. requested=${games.length}, stored=${stored}, skipped=${skipped}.`
    });

    return {
      provider: "gamevalue",
      mode: "internal",
      requested: games.length,
      stored,
      skipped,
      failed: 0,
      errors: [],
      results
    };
  }

  private async ingestOffers(
    offers: NormalizedInternalOffer[],
    sourceInfo: { sourceName: string; sourceType: PriceSourceType }
  ): Promise<ApiPriceIngestionResponse> {
    const response: ApiPriceIngestionResponse = {
      provider: "gamevalue",
      mode: "internal",
      requested: offers.length,
      stored: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      results: []
    };

    const sourceResult = await repositories.prices.upsertPriceSource({
      name: sourceInfo.sourceName,
      type: sourceInfo.sourceType
    });

    for (const input of offers) {
      try {
        const game = await repositories.games.findBySteamAppId(input.steamAppId);
        if (!game) {
          response.skipped += 1;
          response.results.push({
            input: String(input.steamAppId),
            gameId: null,
            steamAppId: input.steamAppId,
            title: input.title ?? null,
            createdStore: false,
            createdSource: sourceResult.created,
            offerId: null,
            snapshotId: null,
            skipped: true,
            message: "Game is not imported yet."
          });
          continue;
        }

        const storeResult = await repositories.prices.upsertStore({
          name: input.storeName,
          storeType: input.storeType ?? "unknown",
          websiteUrl: originOrNull(input.externalUrl ?? null)
        });
        const offer = buildStoreOffer(game, input, storeResult.store, sourceResult.source);
        await repositories.games.upsertOffers(game.id, [offer]);
        const snapshot = await this.appendSnapshot(game, sourceResult.source);

        response.stored += 1;
        response.results.push({
          input: String(input.steamAppId),
          gameId: game.id,
          steamAppId: game.steamAppId,
          title: game.title,
          createdStore: storeResult.created,
          createdSource: sourceResult.created,
          offerId: offer.id,
          snapshotId: snapshot?.id ?? null,
          skipped: false,
          message: null
        });
      } catch (error) {
        response.failed += 1;
        response.errors.push({
          input: String(input.steamAppId),
          message: error instanceof Error ? error.message : "Unknown GameValue price ingestion error."
        });
      }
    }

    await repositories.diagnostics.recordIntegrationLog({
      service: "price",
      level: response.failed > 0 ? "warning" : "info",
      message: `GameValue price ingestion finished. source=${sourceInfo.sourceName}, requested=${response.requested}, stored=${response.stored}, skipped=${response.skipped}, failed=${response.failed}.`
    });

    return response;
  }

  private async appendSnapshot(game: Game, source: PriceSource): Promise<GamePriceSnapshot | null> {
    const offers = trustedOffersOnly(await repositories.games.listOffers(game.id));
    const bestOffer = offers[0] ?? null;
    if (!bestOffer) {
      return null;
    }
    const history = await repositories.snapshots.listPrices(game.id);
    const price = bestOffer.price;
    const previousLow = history.length > 0 ? Math.min(...history.map((snapshot) => snapshot.historicalLow)) : price;
    const historicalLow = Math.min(previousLow, bestOffer.historicalLow ?? price);
    const now = new Date();
    const snapshot: GamePriceSnapshot = {
      id: `price-${game.id}-gamevalue-${now.getTime()}`,
      gameId: game.id,
      steamAppId: game.steamAppId,
      sourceId: bestOffer.sourceId ?? source.id,
      provider: bestOffer.provider,
      storeType: bestOffer.storeType,
      price,
      bestPrice: price,
      historicalLow,
      basePrice: bestOffer.regularPrice ?? price,
      discountPercent: bestOffer.discountPercent,
      storeName: bestOffer.storeName,
      currency: bestOffer.currency,
      externalUrl: bestOffer.externalUrl ?? bestOffer.url,
      offerCount: offers.length,
      isHistoricalLow: price <= historicalLow,
      sourceRawId: bestOffer.sourceRawId,
      rawProviderData: bestOffer.rawProviderData,
      fetchedAt: bestOffer.fetchedAt ?? now,
      capturedAt: now,
      createdAt: now,
      source: bestOffer.source,
      sourceConfidence: bestOffer.sourceConfidence,
      sourceName: bestOffer.sourceName ?? source.name,
      sourceType: bestOffer.sourceType ?? source.type
    };
    await repositories.snapshots.appendPrice(snapshot);
    return snapshot;
  }
}

function buildStoreOffer(
  game: Game,
  input: NormalizedInternalOffer,
  store: Store,
  source: PriceSource
): StoreOffer {
  const now = new Date();
  const regularPrice = input.regularPrice ?? input.price;
  const discountPercent =
    regularPrice <= 0 ? 0 : Math.max(0, Math.round((1 - input.price / regularPrice) * 100));
  const externalUrl = input.externalUrl ?? null;
  return {
    id: `offer-${game.id}-gamevalue-${store.slug}`,
    gameId: game.id,
    steamAppId: game.steamAppId,
    storeId: store.id,
    sourceId: source.id,
    provider: "gamevalue",
    storeName: store.name,
    storeType: input.storeType ?? store.storeType,
    title: input.title ?? game.title,
    price: roundMoney(input.price),
    regularPrice: regularPrice === null ? null : roundMoney(regularPrice),
    historicalLow: roundMoney(input.price),
    currency: input.currency ?? "PLN",
    discountPercent,
    url: externalUrl ?? "https://ludolog.vercel.app",
    externalUrl,
    region: input.region ?? "PL",
    isOfficial: input.isOfficialStore ?? store.storeType === "official",
    isOfficialStore: input.isOfficialStore ?? store.storeType === "official",
    isHistoricalLow: true,
    available: input.available ?? true,
    drm: input.drm ?? "Steam",
    platform: input.platform ?? game.platform,
    sourceRawId: `${source.name}:${game.steamAppId}:${store.slug}`,
    rawProviderData: {
      sourceName: source.name,
      sourceType: source.type,
      importedAt: now.toISOString()
    },
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
    source: "manual",
    sourceConfidence: "internal-real"
  };
}

function parseCsvOffers(csv: string, sourceName: string): NormalizedInternalOffer[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine) {
    return [];
  }
  const headers = parseCsvLine(headerLine).map((header) => header.trim());
  return rows.map((row) => {
    const values = parseCsvLine(row);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return {
      steamAppId: Number(record.steamAppId),
      storeName: record.storeName,
      storeType: normalizeStoreType(record.storeType),
      price: Number(record.price),
      regularPrice: record.regularPrice ? Number(record.regularPrice) : undefined,
      currency: record.currency || "PLN",
      externalUrl: record.externalUrl || null,
      region: record.region || "PL",
      drm: record.drm || "Steam",
      platform: record.platform || undefined,
      isOfficialStore: record.isOfficialStore === "true",
      available: record.available !== "false",
      title: record.title || undefined,
      sourceName,
      sourceType: "csv"
    };
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeStoreType(value: string | undefined): StoreType {
  if (value === "official" || value === "keyshop" || value === "marketplace" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function emptyResponse(requested: number, error: { input: string; message: string }): ApiPriceIngestionResponse {
  return {
    provider: "gamevalue",
    mode: "internal",
    requested,
    stored: 0,
    skipped: 0,
    failed: 1,
    errors: [error],
    results: []
  };
}

function originOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const gameValuePriceService = new GameValuePriceService();
