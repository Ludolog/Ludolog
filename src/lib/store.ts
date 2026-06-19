import {
  DEMO_USER_ID,
  getDataMode,
  getGGDealsApiKey,
  getGogCountryCode,
  getGogCurrency,
  getSteamStoreCountryCode,
  getSteamStoreCurrency,
  getSteamStorePriceCacheTtlMinutes,
  getSteamStorePriceMaxPerRun,
  getPriceMode,
  getPriceProvider,
  isSteamStorePriceEnabled,
  isGogEnabled
} from "@/lib/config";
import {
  mockGames,
  mockPlayerSnapshots,
  mockPriceAlerts,
  mockPriceSnapshots,
  mockStoreOffers,
  mockUsers,
  mockWatchlistItems
} from "@/lib/mock-data";
import { calculateGameValueScore } from "@/lib/services/deal-score-service";
import { resolveGGDealsStatusFromLogs } from "@/lib/services/ggdeals-diagnostics";
import { compareTrustedOffers, isTrustedPriceSource, trustedOffersOnly } from "@/lib/services/price-source-utils";
import type {
  AdminStatus,
  Game,
  GameExternalMapping,
  GameImportInput,
  GamePriceSnapshot,
  GameProfile,
  GameSummary,
  GogCatalogEntry,
  GogMappingConfidence,
  GogRepositoryStatus,
  IntegrationLog,
  PlayerCountSnapshot,
  PriceAlert,
  PriceSource,
  PriceSourceType,
  SteamCatalogEntry,
  SteamCatalogStatus,
  Store,
  StoreOffer,
  StoreType,
  User,
  WatchlistItem
} from "@/lib/types";

const games: Game[] = [...mockGames];
const storeOffers: StoreOffer[] = [...mockStoreOffers];
const priceSnapshots: GamePriceSnapshot[] = [...mockPriceSnapshots];
const stores: Store[] = buildInitialStores(storeOffers);
const priceSources: PriceSource[] = [
  {
    id: "price-source-mock-seed",
    name: "mock-seed",
    type: "mock",
    isActive: true,
    createdAt: new Date("2026-06-18T12:00:00.000Z"),
    updatedAt: new Date("2026-06-18T12:00:00.000Z")
  }
];
const playerSnapshots: PlayerCountSnapshot[] = [...mockPlayerSnapshots];
const steamCatalogEntries: SteamCatalogEntry[] = [];
const gogCatalogEntries: GogCatalogEntry[] = [];
const gameExternalMappings: GameExternalMapping[] = [];
const users: User[] = [...mockUsers];
const watchlistItems: WatchlistItem[] = [...mockWatchlistItems];
const priceAlerts: PriceAlert[] = [...mockPriceAlerts];
const dayMs = 24 * 60 * 60 * 1000;
const integrationLogs: IntegrationLog[] = [
  {
    id: "log-mock-mode",
    service: "snapshot",
    level: "info",
    message: "Application started in mock-ready mode.",
    createdAt: new Date("2026-06-18T12:00:00.000Z")
  }
];

function latestByDate<T extends { capturedAt: Date }>(items: T[]): T | null {
  return [...items].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0] ?? null;
}

function removeMatching<T>(items: T[], predicate: (item: T) => boolean): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      items.splice(index, 1);
    }
  }
}

function priceHistory(gameId: string): GamePriceSnapshot[] {
  return priceSnapshots
    .filter((snapshot) => snapshot.gameId === gameId)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

function playerHistory(gameId: string): PlayerCountSnapshot[] {
  return playerSnapshots
    .filter((snapshot) => snapshot.gameId === gameId)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

export function listGames(): Game[] {
  return [...games].sort((a, b) => a.title.localeCompare(b.title));
}

export function listImportedGames(limit = 50): Game[] {
  return games
    .filter((game) => game.source !== "mock")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export function getGameById(id: string): Game | null {
  return games.find((game) => game.id === id || game.slug === id) ?? null;
}

export function getGameBySteamAppId(steamAppId: number): Game | null {
  return games.find((game) => game.steamAppId === steamAppId) ?? null;
}

export function importGameFromCatalog(input: GameImportInput): GameSummary {
  const existing = getGameBySteamAppId(input.steamAppId) ?? getGameById(input.id);
  if (existing) {
    return getGameSummary(existing);
  }

  const now = new Date();
  const game: Game = {
    id: input.id,
    steamAppId: input.steamAppId,
    title: input.title,
    slug: input.slug,
    platform: input.platform,
    description: input.description,
    coverUrl: input.coverUrl,
    genres: input.genres,
    developer: input.developer,
    publisher: input.publisher,
    releaseDate: input.releaseDate,
    reviewScore: input.reviewScore,
    source: input.source,
    createdAt: now,
    updatedAt: now
  };
  games.push(game);

  const previousPlayers = Math.max(0, Math.round(input.currentPlayers / Math.max(input.trendFactor, 0.1)));
  playerSnapshots.push(
    {
      id: `players-${input.id}-import-previous`,
      gameId: input.id,
      steamAppId: input.steamAppId,
      playersOnline: previousPlayers,
      capturedAt: new Date(now.getTime() - dayMs),
      source: "mock"
    },
    {
      id: `players-${input.id}-import-current`,
      gameId: input.id,
      steamAppId: input.steamAppId,
      playersOnline: input.currentPlayers,
      capturedAt: now,
      source: "mock"
    }
  );

  priceSnapshots.push({
    id: `price-${input.id}-import-current`,
    gameId: input.id,
    steamAppId: input.steamAppId,
    sourceId: "price-source-mock-seed",
    provider: "mock",
    storeType: "official",
    price: input.currentPrice,
    bestPrice: input.currentPrice,
    historicalLow: input.historicalLow,
    basePrice: input.basePrice,
    discountPercent: input.basePrice === 0 ? 0 : Math.max(0, Math.round((1 - input.currentPrice / input.basePrice) * 100)),
    storeName: "Steam",
    currency: "PLN",
    externalUrl: `https://store.steampowered.com/app/${input.steamAppId}`,
    offerCount: 1,
    isHistoricalLow: input.currentPrice <= input.historicalLow,
    sourceRawId: null,
    rawProviderData: null,
    fetchedAt: now,
    capturedAt: now,
    createdAt: now,
    source: "mock",
    sourceConfidence: "internal-mock"
  });

  storeOffers.push({
    id: `offer-${input.id}-import-steam`,
    gameId: input.id,
    steamAppId: input.steamAppId,
    storeId: "store-steam",
    sourceId: "price-source-mock-seed",
    provider: "mock",
    storeName: "Steam",
    storeType: "official",
    title: input.title,
    price: input.currentPrice,
    regularPrice: input.basePrice,
    historicalLow: input.historicalLow,
    currency: "PLN",
    discountPercent: input.basePrice === 0 ? 0 : Math.max(0, Math.round((1 - input.currentPrice / input.basePrice) * 100)),
    url: `https://store.steampowered.com/app/${input.steamAppId}`,
    externalUrl: `https://store.steampowered.com/app/${input.steamAppId}`,
    region: "PL",
    isOfficial: true,
    isOfficialStore: true,
    isHistoricalLow: input.currentPrice <= input.historicalLow,
    available: true,
    drm: "Steam",
    platform: input.platform,
    sourceRawId: null,
    rawProviderData: null,
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
    source: "mock",
    sourceConfidence: "internal-mock"
  });

  return getGameSummary(game);
}

export function searchGames(query: string): GameSummary[] {
  const normalized = query.trim().toLowerCase();

  return games
    .filter((game) => {
      const text = `${game.title} ${game.slug} ${game.genres.join(" ")}`.toLowerCase();
      return text.includes(normalized);
    })
    .map(getGameSummary)
    .filter((summary): summary is GameSummary => summary !== null)
    .sort((a, b) => b.score.score - a.score.score);
}

export function getGameSummary(game: Game): GameSummary;
export function getGameSummary(gameId: string): GameSummary | null;
export function getGameSummary(gameOrId: Game | string): GameSummary | null {
  const game = typeof gameOrId === "string" ? getGameById(gameOrId) : gameOrId;
  if (!game) {
    return null;
  }

  const prices = priceHistory(game.id);
  const players = playerHistory(game.id);
  const offers = getOffersForGame(game.id);
  const trustedPrices = prices.filter((snapshot) => isTrustedPriceSource(snapshot.source));
  const trustedOffers = trustedOffersOnly(offers);
  const latestPrice = latestByDate(trustedPrices);
  const latestPlayers = latestByDate(players);
  const bestOffer = trustedOffers[0] ?? null;

  return {
    game,
    latestPrice,
    latestPlayers,
    bestOffer,
    score: calculateGameValueScore({
      latestPrice,
      priceHistory: trustedPrices,
      latestPlayers,
      playerHistory: players,
      offers: trustedOffers,
      reviewScore: game.reviewScore
    })
  };
}

export function getGameProfile(gameId: string): GameProfile | null {
  const summary = getGameSummary(gameId);
  if (!summary) {
    return null;
  }

  const prices = priceHistory(summary.game.id);
  const players = playerHistory(summary.game.id);
  const offers = getOffersForGame(summary.game.id);
  const historicalLow = prices.length > 0 ? Math.min(...prices.map((snapshot) => snapshot.historicalLow)) : null;
  const priceDeltaPercent =
    summary.latestPrice && historicalLow !== null && historicalLow > 0
      ? Math.round(((summary.latestPrice.price - historicalLow) / historicalLow) * 1000) / 10
      : summary.latestPrice?.price === 0
        ? 0
        : null;

  return {
    ...summary,
    priceHistory: prices,
    playerHistory: players,
    offers,
    historicalLow,
    priceDeltaPercent
  };
}

export function getBestDeals(limit = 5): GameSummary[] {
  return games
    .map(getGameSummary)
    .filter((summary): summary is GameSummary => summary !== null)
    .sort((a, b) => {
      const priceBias = (b.latestPrice?.discountPercent ?? 0) - (a.latestPrice?.discountPercent ?? 0);
      return b.score.score - a.score.score || priceBias;
    })
    .slice(0, limit);
}

export function getMostActiveGames(limit = 5): GameSummary[] {
  return games
    .map(getGameSummary)
    .filter((summary): summary is GameSummary => summary !== null)
    .sort((a, b) => (b.latestPlayers?.playersOnline ?? 0) - (a.latestPlayers?.playersOnline ?? 0))
    .slice(0, limit);
}

export function getOffersForGame(gameId: string): StoreOffer[] {
  return storeOffers
    .filter((offer) => offer.gameId === gameId)
    .sort(compareOffers);
}

function compareOffers(a: StoreOffer, b: StoreOffer): number {
  return compareTrustedOffers(a, b);
}

export function upsertStoreOffers(gameId: string, offers: StoreOffer[]): void {
  for (const offer of offers) {
    const index = storeOffers.findIndex((item) => item.id === offer.id);
    if (index === -1) {
      storeOffers.push({ ...offer, gameId });
    } else {
      storeOffers[index] = { ...storeOffers[index], ...offer, gameId };
    }
  }
}

export function upsertStore(input: {
  name: string;
  slug?: string;
  storeType: StoreType;
  websiteUrl?: string | null;
}): { store: Store; created: boolean } {
  const slug = input.slug ?? slugify(input.name);
  const existing = stores.find((store) => store.slug === slug);
  const now = new Date();
  if (existing) {
    existing.name = input.name;
    existing.storeType = input.storeType;
    existing.websiteUrl = input.websiteUrl ?? existing.websiteUrl;
    existing.updatedAt = now;
    return { store: existing, created: false };
  }

  const store: Store = {
    id: `store-${slug}`,
    name: input.name,
    slug,
    storeType: input.storeType,
    websiteUrl: input.websiteUrl ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  stores.push(store);
  return { store, created: true };
}

export function upsertPriceSource(input: {
  name: string;
  type: PriceSourceType;
}): { source: PriceSource; created: boolean } {
  const existing = priceSources.find((source) => source.name === input.name);
  const now = new Date();
  if (existing) {
    existing.type = input.type;
    existing.updatedAt = now;
    return { source: existing, created: false };
  }

  const source: PriceSource = {
    id: `price-source-${slugify(input.name)}`,
    name: input.name,
    type: input.type,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  priceSources.push(source);
  return { source, created: true };
}

export function listStores(): Store[] {
  return [...stores].sort((a, b) => a.name.localeCompare(b.name));
}

export function listPriceSources(): PriceSource[] {
  return [...priceSources].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPriceHistory(gameId: string): GamePriceSnapshot[] {
  return priceHistory(gameId);
}

export function getPlayerHistory(gameId: string): PlayerCountSnapshot[] {
  return playerHistory(gameId);
}

export function getLatestPlayersBySteamAppId(steamAppId: number): PlayerCountSnapshot | null {
  return latestByDate(playerSnapshots.filter((snapshot) => snapshot.steamAppId === steamAppId));
}

export function getLatestPlayerRefresh(): Date | null {
  return latestByDate(playerSnapshots)?.capturedAt ?? null;
}

export function countPlayerSnapshotsBySource(source: "mock" | "steam-api"): number {
  return playerSnapshots.filter((snapshot) => snapshot.source === source).length;
}

export function getLatestPriceRefresh(): Date | null {
  return latestByDate(priceSnapshots)?.capturedAt ?? null;
}

export function countPriceSnapshotsBySource(source: "mock" | "ggdeals" | "price-api" | "manual" | "gog" | "steam-store"): number {
  return priceSnapshots.filter((snapshot) => snapshot.source === source).length;
}

export function countOffersBySource(source: "mock" | "ggdeals" | "price-api" | "manual" | "gog" | "steam-store"): number {
  return storeOffers.filter((offer) => offer.source === source).length;
}

export function previewMockPriceCleanup(): {
  mockStoreOfferCount: number;
  mockPriceSnapshotCount: number;
  mockPriceSourceCount: number;
  affectedGameCount: number;
  affectedGames: Array<{
    gameId: string;
    steamAppId: number;
    title: string;
    mockOfferCount: number;
    mockPriceSnapshotCount: number;
  }>;
  examples: Array<{
    kind: "offer" | "price-snapshot" | "price-source";
    id: string;
    gameId?: string | null;
    steamAppId?: number | null;
    title?: string | null;
    storeName?: string | null;
    sourceName?: string | null;
  }>;
} {
  const mockOffers = storeOffers.filter((offer) => offer.source === "mock" || offer.provider === "mock");
  const mockSnapshots = priceSnapshots.filter((snapshot) => snapshot.source === "mock" || snapshot.provider === "mock");
  const mockSources = priceSources.filter((source) => source.type === "mock" || source.name.toLowerCase().includes("mock"));
  const gameIds = new Set([...mockOffers.map((offer) => offer.gameId), ...mockSnapshots.map((snapshot) => snapshot.gameId)]);
  const affectedGames = [...gameIds]
    .map((gameId) => {
      const game = getGameById(gameId);
      if (!game) {
        return null;
      }
      return {
        gameId,
        steamAppId: game.steamAppId,
        title: game.title,
        mockOfferCount: mockOffers.filter((offer) => offer.gameId === gameId).length,
        mockPriceSnapshotCount: mockSnapshots.filter((snapshot) => snapshot.gameId === gameId).length
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.mockOfferCount + b.mockPriceSnapshotCount - (a.mockOfferCount + a.mockPriceSnapshotCount));

  return {
    mockStoreOfferCount: mockOffers.length,
    mockPriceSnapshotCount: mockSnapshots.length,
    mockPriceSourceCount: mockSources.length,
    affectedGameCount: affectedGames.length,
    affectedGames,
    examples: [
      ...mockOffers.slice(0, 3).map((offer) => ({
        kind: "offer" as const,
        id: offer.id,
        gameId: offer.gameId,
        steamAppId: offer.steamAppId,
        title: offer.title,
        storeName: offer.storeName,
        sourceName: offer.sourceName ?? offer.source
      })),
      ...mockSnapshots.slice(0, 3).map((snapshot) => ({
        kind: "price-snapshot" as const,
        id: snapshot.id,
        gameId: snapshot.gameId,
        steamAppId: snapshot.steamAppId,
        title: null,
        storeName: snapshot.storeName,
        sourceName: snapshot.sourceName ?? snapshot.source
      })),
      ...mockSources.slice(0, 3).map((source) => ({
        kind: "price-source" as const,
        id: source.id,
        gameId: null,
        steamAppId: null,
        title: null,
        storeName: null,
        sourceName: source.name
      }))
    ].slice(0, 8)
  };
}

export function runMockPriceCleanup(): ReturnType<typeof previewMockPriceCleanup> & {
  deletedStoreOffers: number;
  deletedPriceSnapshots: number;
  deletedPriceSources: number;
} {
  const preview = previewMockPriceCleanup();
  removeMatching(storeOffers, (offer) => offer.source === "mock" || offer.provider === "mock");
  removeMatching(priceSnapshots, (snapshot) => snapshot.source === "mock" || snapshot.provider === "mock");
  removeMatching(priceSources, (source) => source.type === "mock" || source.name.toLowerCase().includes("mock"));
  return {
    ...preview,
    deletedStoreOffers: preview.mockStoreOfferCount,
    deletedPriceSnapshots: preview.mockPriceSnapshotCount,
    deletedPriceSources: preview.mockPriceSourceCount
  };
}

export function appendPriceSnapshot(snapshot: GamePriceSnapshot): void {
  priceSnapshots.push(snapshot);
}

export function appendPlayerSnapshot(snapshot: PlayerCountSnapshot): void {
  playerSnapshots.push(snapshot);
}

export function searchSteamCatalogEntries(query: string, limit = 12): SteamCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return steamCatalogEntries
    .filter((entry) => entry.isGame && entry.isActive && entry.title.toLowerCase().includes(normalized))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function findSteamCatalogEntryBySteamAppId(steamAppId: number): SteamCatalogEntry | null {
  return steamCatalogEntries.find((entry) => entry.steamAppId === steamAppId) ?? null;
}

export function upsertSteamCatalogEntries(
  entries: Array<Omit<SteamCatalogEntry, "createdAt" | "updatedAt">>
): { created: number; updated: number } {
  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const entry of entries) {
    const existing = steamCatalogEntries.find((item) => item.steamAppId === entry.steamAppId);
    if (existing) {
      Object.assign(existing, entry, { updatedAt: now });
      updated += 1;
    } else {
      steamCatalogEntries.push({ ...entry, createdAt: now, updatedAt: now });
      created += 1;
    }
  }

  return { created, updated };
}

export function getSteamCatalogStatus(): SteamCatalogStatus {
  const latest = latestByDate(steamCatalogEntries.map((entry) => ({ capturedAt: entry.syncedAt })));
  const highestAppId = steamCatalogEntries.reduce<number | null>(
    (highest, entry) => (highest === null ? entry.steamAppId : Math.max(highest, entry.steamAppId)),
    null
  );
  return {
    entryCount: steamCatalogEntries.length,
    activeGameCount: steamCatalogEntries.filter((entry) => entry.isGame && entry.isActive).length,
    lastSyncedAt: latest?.capturedAt ?? null,
    nextStartAfterAppId: highestAppId
  };
}

export function searchGogCatalogEntries(query: string, limit = 10): GogCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return gogCatalogEntries
    .filter(
      (entry) =>
        entry.isActive &&
        (entry.title.toLowerCase().includes(normalized) ||
          entry.slug.toLowerCase().includes(normalized) ||
          entry.gogProductId === normalized)
    )
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function upsertGogCatalogEntries(
  entries: Array<Omit<GogCatalogEntry, "createdAt" | "updatedAt">>
): { created: number; updated: number } {
  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const entry of entries) {
    const existing = gogCatalogEntries.find((item) => item.gogProductId === entry.gogProductId);
    if (existing) {
      Object.assign(existing, entry, { updatedAt: now });
      updated += 1;
    } else {
      gogCatalogEntries.push({ ...entry, createdAt: now, updatedAt: now });
      created += 1;
    }
  }

  return { created, updated };
}

export function listGogMappings(limit = 100): GameExternalMapping[] {
  return gameExternalMappings
    .filter((mapping) => mapping.provider === "gog")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export function findGogMappingByGameId(gameId: string): GameExternalMapping | null {
  return gameExternalMappings.find((mapping) => mapping.provider === "gog" && mapping.gameId === gameId) ?? null;
}

export function findGogMappingsByGameIds(gameIds: string[]): GameExternalMapping[] {
  const wanted = new Set(gameIds);
  return gameExternalMappings.filter((mapping) => mapping.provider === "gog" && wanted.has(mapping.gameId));
}

export function upsertGogMapping(input: {
  gameId: string;
  externalId: string;
  externalSlug?: string | null;
  confidence: GogMappingConfidence;
}): GameExternalMapping {
  const existing = gameExternalMappings.find((mapping) => mapping.provider === "gog" && mapping.gameId === input.gameId);
  const now = new Date();
  if (existing) {
    existing.externalId = input.externalId;
    existing.externalSlug = input.externalSlug ?? null;
    existing.confidence = input.confidence;
    existing.updatedAt = now;
    return existing;
  }

  const mapping: GameExternalMapping = {
    id: `mapping-gog-${input.gameId}-${input.externalId}`,
    gameId: input.gameId,
    provider: "gog",
    externalId: input.externalId,
    externalSlug: input.externalSlug ?? null,
    confidence: input.confidence,
    createdAt: now,
    updatedAt: now
  };
  gameExternalMappings.push(mapping);
  return mapping;
}

export function getGogRepositoryStatus(): GogRepositoryStatus {
  const latest = latestByDate(gogCatalogEntries.map((entry) => ({ capturedAt: entry.syncedAt })));
  const lastSearch = integrationLogs.find((log) => log.service === "gog" && log.message.startsWith("GOG catalog search"));
  return {
    gogCatalogEntries: gogCatalogEntries.length,
    gogMappings: gameExternalMappings.filter((mapping) => mapping.provider === "gog").length,
    lastGogSync: latest?.capturedAt ?? null,
    lastGogCatalogSearch: lastSearch?.createdAt ?? null
  };
}

export function listWatchlist(userId = DEMO_USER_ID): Array<WatchlistItem & { summary: GameSummary | null }> {
  return watchlistItems
    .filter((item) => item.userId === userId)
    .map((item) => ({ ...item, summary: getGameSummary(item.gameId) }));
}

export function addWatchlistItem(gameId: string, targetPrice?: number | null, userId = DEMO_USER_ID): WatchlistItem {
  const existing = watchlistItems.find((item) => item.userId === userId && item.gameId === gameId);
  if (existing) {
    existing.targetPrice = targetPrice ?? existing.targetPrice;
    existing.alertEnabled = targetPrice !== undefined ? targetPrice !== null : existing.alertEnabled;
    return existing;
  }

  const item: WatchlistItem = {
    id: `watch-${gameId}-${Date.now()}`,
    userId,
    gameId,
    targetPrice: targetPrice ?? null,
    alertEnabled: targetPrice !== undefined && targetPrice !== null,
    createdAt: new Date()
  };
  watchlistItems.push(item);
  return item;
}

export function removeWatchlistItem(id: string, userId = DEMO_USER_ID): boolean {
  const index = watchlistItems.findIndex((item) => item.id === id && item.userId === userId);
  if (index === -1) {
    return false;
  }

  watchlistItems.splice(index, 1);
  return true;
}

export function createPriceAlert(
  gameId: string,
  thresholdPrice: number,
  userId = DEMO_USER_ID
): PriceAlert {
  const alert: PriceAlert = {
    id: `alert-${gameId}-${Date.now()}`,
    userId,
    gameId,
    thresholdPrice,
    isActive: true,
    triggeredAt: null,
    createdAt: new Date()
  };
  priceAlerts.push(alert);
  return alert;
}

export function listPriceAlerts(userId = DEMO_USER_ID): PriceAlert[] {
  return priceAlerts.filter((alert) => alert.userId === userId);
}

export function checkTriggeredAlerts(): PriceAlert[] {
  const triggered: PriceAlert[] = [];

  for (const alert of priceAlerts) {
    if (!alert.isActive) {
      continue;
    }

    const latestPrice = latestByDate(priceHistory(alert.gameId));
    if (latestPrice && latestPrice.price <= alert.thresholdPrice) {
      alert.triggeredAt = new Date();
      alert.isActive = false;
      triggered.push(alert);
    }
  }

  return triggered;
}

export function recordIntegrationLog(log: Omit<IntegrationLog, "id" | "createdAt">): IntegrationLog {
  const entry: IntegrationLog = {
    ...log,
    id: `log-${Date.now()}-${integrationLogs.length + 1}`,
    createdAt: new Date()
  };
  integrationLogs.unshift(entry);
  return entry;
}

export function listIntegrationLogs(limit = 20): IntegrationLog[] {
  return integrationLogs.slice(0, limit);
}

export function listUsers(): User[] {
  return [...users];
}

export function getAdminStatus(): AdminStatus {
  const steamStorePriceSnapshotCount = countPriceSnapshotsBySource("steam-store");
  const steamStoreOfferCount = countOffersBySource("steam-store");
  const realInternalPriceSnapshots =
    countPriceSnapshotsBySource("manual") + countPriceSnapshotsBySource("gog") + steamStorePriceSnapshotCount;
  const realPriceSnapshots =
    realInternalPriceSnapshots + countPriceSnapshotsBySource("ggdeals") + countPriceSnapshotsBySource("price-api");
  const realOffers =
    countOffersBySource("manual") +
    countOffersBySource("gog") +
    steamStoreOfferCount +
    countOffersBySource("ggdeals") +
    countOffersBySource("price-api");
  const integrationLogs = listIntegrationLogs();
  const gogLogs = integrationLogs.filter((log) => log.service === "gog");
  const ggdealsRuntime = resolveGGDealsStatusFromLogs({
    hasApiKey: Boolean(getGGDealsApiKey()),
    logs: integrationLogs,
    realOffers,
    realPriceSnapshots
  });

  return {
    mode: getDataMode(),
    gameCount: games.length,
    steamCatalogEntryCount: steamCatalogEntries.length,
    importedGameCount: games.filter((game) => game.source !== "mock").length,
    lastSteamCatalogSync: getSteamCatalogStatus().lastSyncedAt,
    lastPlayerCountRefresh: getLatestPlayerRefresh(),
    offerCount: storeOffers.length,
    priceSnapshotCount: priceSnapshots.length,
    storeCount: stores.length,
    priceSourceCount: priceSources.length,
    playerSnapshotCount: playerSnapshots.length,
    watchlistCount: watchlistItems.length,
    alertCount: priceAlerts.length,
    priceProvider: getPriceProvider(),
    priceMode: getPriceMode(),
    hasGGDealsApiKey: Boolean(getGGDealsApiKey()),
    ggdealsStatus: ggdealsRuntime.status,
    lastGGDealsCheck: ggdealsRuntime.lastCheckedAt,
    lastPriceRefresh: getLatestPriceRefresh(),
    realInternalPriceSnapshots,
    realPriceSnapshots,
    mockPriceSnapshots: countPriceSnapshotsBySource("mock"),
    realOffers,
    mockOffers: countOffersBySource("mock"),
    gogEnabled: isGogEnabled(),
    gogCatalogEntries: gogCatalogEntries.length,
    gogMappings: gameExternalMappings.filter((mapping) => mapping.provider === "gog").length,
    gogMappedGames: new Set(gameExternalMappings.filter((mapping) => mapping.provider === "gog").map((mapping) => mapping.gameId)).size,
    gogOfferCount: countOffersBySource("gog"),
    gogPriceSnapshotCount: countPriceSnapshotsBySource("gog"),
    lastGogSync: getGogRepositoryStatus().lastGogSync,
    lastGogCatalogSearch: getGogRepositoryStatus().lastGogCatalogSearch,
    lastGogError: gogLogs.find((log) => log.level === "error") ?? null,
    lastGogPriceRefresh: latestByDate(priceSnapshots.filter((snapshot) => snapshot.source === "gog"))?.capturedAt ?? null,
    gogCountryCode: getGogCountryCode(),
    gogCurrency: getGogCurrency(),
    gogStatusMessage: isGogEnabled() ? null : "GOG connector disabled by environment.",
    steamStorePriceEnabled: isSteamStorePriceEnabled(),
    steamStoreCountryCode: getSteamStoreCountryCode(),
    steamStoreCurrency: getSteamStoreCurrency(),
    steamStoreMaxPerRun: getSteamStorePriceMaxPerRun(),
    steamStoreCacheTtlMinutes: getSteamStorePriceCacheTtlMinutes(),
    steamStoreOfferCount,
    steamStorePriceSnapshotCount,
    lastSteamStorePriceRefresh:
      latestByDate(priceSnapshots.filter((snapshot) => snapshot.source === "steam-store"))?.capturedAt ?? null,
    lastSteamStorePriceError: integrationLogs.find((log) => log.service === "steam-store" && log.level === "error") ?? null,
    realPlayerSnapshots: countPlayerSnapshotsBySource("steam-api"),
    mockPlayerSnapshots: countPlayerSnapshotsBySource("mock"),
    integrationLogs
  };
}

function buildInitialStores(offers: StoreOffer[]): Store[] {
  const now = new Date("2026-06-18T12:00:00.000Z");
  const bySlug = new Map<string, Store>();
  for (const offer of offers) {
    const slug = slugify(offer.storeName);
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        id: `store-${slug}`,
        name: offer.storeName,
        slug,
        storeType: offer.storeType,
        websiteUrl: offer.externalUrl ?? offer.url ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
    }
  }
  return [...bySlug.values()];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}
