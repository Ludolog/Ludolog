import Link from "next/link";
import { AlertTriangle, Database, RefreshCw, Server, ShoppingCart } from "lucide-react";

import { RefreshButton } from "@/components/forms/refresh-button";
import { AdminActionButton } from "@/components/forms/admin-action-button";
import { AdminSecretPanel } from "@/components/forms/admin-secret-panel";
import { formatDate, formatNumber, formatPrice } from "@/lib/format";
import { repositories } from "@/lib/repositories";
import { gameSearchService } from "@/lib/services/game-search-service";
import { steamCatalogStatusService } from "@/lib/services/steam-catalog-status-service";

export const dynamic = "force-dynamic";

const starterSteamAppIds = [
  730, 570, 578080, 1172470, 1091500, 292030, 1086940, 1245620, 105600, 413150,
  227300, 252490, 230410, 1085660, 440, 892970, 108600, 275850, 381210, 238960
];

export default async function AdminPage(): Promise<React.ReactElement> {
  const status = await repositories.diagnostics.getAdminStatus();
  const steamStatus = await steamCatalogStatusService.getStatus();
  const games = await gameSearchService.list();
  const gameRows = await Promise.all(
    games.map(async (game) => ({
      game,
      summary: await gameSearchService.getSummary(game.id)
    }))
  );
  const nextSteamCatalogStartAfterAppId = steamStatus.nextSteamCatalogStartAfterAppId ?? undefined;

  return (
    <div className="space-y-6">
      <section className="surface rounded-lg p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-amber/35 bg-radar-amber/10 text-radar-amber">
            <Server size={20} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin/dev dashboard</h1>
            <p className="text-sm text-slate-400">Podgląd danych, snapshotów i statusu adapterów.</p>
          </div>
        </div>
      </section>

      <AdminSecretPanel />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatusCard icon={<Database size={18} />} label="Mode" value={status.mode.toUpperCase()} />
        <StatusCard icon={<Database size={18} />} label="DATA_MODE=api" value={steamStatus.dataMode === "api" ? "YES" : "NO"} />
        <StatusCard icon={<Database size={18} />} label="Steam key" value={steamStatus.hasSteamApiKey ? "SET" : "MISSING"} />
        <StatusCard icon={<Database size={18} />} label="Real Steam API" value={steamStatus.canUseRealSteamApi ? "READY" : "OFF"} />
        <StatusCard icon={<Database size={18} />} label="Games" value={String(status.gameCount)} />
        <StatusCard icon={<Database size={18} />} label="Steam catalog" value={String(status.steamCatalogEntryCount)} />
        <StatusCard icon={<Database size={18} />} label="Imported" value={String(status.importedGameCount)} />
        <StatusCard icon={<Database size={18} />} label="Offers" value={String(status.offerCount)} />
        <StatusCard icon={<RefreshCw size={18} />} label="Price snapshots" value={String(status.priceSnapshotCount)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Price provider" value={status.priceProvider.toUpperCase()} />
        <StatusCard icon={<ShoppingCart size={18} />} label="PRICE_MODE" value={status.priceMode.toUpperCase()} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Stores" value={String(status.storeCount)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Price sources" value={String(status.priceSourceCount)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Internal snaps" value={String(status.realInternalPriceSnapshots)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Real price snaps" value={String(status.realPriceSnapshots)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Real offers" value={String(status.realOffers)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="GOG enabled" value={status.gogEnabled ? "YES" : "NO"} />
        <StatusCard icon={<ShoppingCart size={18} />} label="GOG mappings" value={String(status.gogMappings)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="GOG offers" value={String(status.gogOfferCount)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="GOG snaps" value={String(status.gogPriceSnapshotCount)} />
        <StatusCard
          icon={<ShoppingCart size={18} />}
          label="Steam Store"
          value={status.steamStorePriceEnabled ? "ON" : "OFF"}
        />
        <StatusCard icon={<ShoppingCart size={18} />} label="Steam offers" value={String(status.steamStoreOfferCount)} />
        <StatusCard
          icon={<ShoppingCart size={18} />}
          label="Steam snaps"
          value={String(status.steamStorePriceSnapshotCount)}
        />
        <StatusCard icon={<RefreshCw size={18} />} label="Player snapshots" value={String(status.playerSnapshotCount)} />
        <StatusCard icon={<RefreshCw size={18} />} label="Real player snaps" value={String(status.realPlayerSnapshots)} />
        <StatusCard icon={<RefreshCw size={18} />} label="Mock player snaps" value={String(status.mockPlayerSnapshots)} />
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">GameValue Price API</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Internal price module for manual admin offers, JSON/CSV imports and price snapshots. External aggregators are
          disabled in active flow; Android and web clients read only our API.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InlineStatus icon={<ShoppingCart size={18} />} label="Provider" value={status.priceProvider} />
          <InlineStatus icon={<ShoppingCart size={18} />} label="Mode" value={status.priceMode} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last price snapshot"
            value={status.lastPriceRefresh ? formatDate(status.lastPriceRefresh) : "n/a"}
          />
          <InlineStatus icon={<Database size={18} />} label="Stores" value={String(status.storeCount)} />
          <InlineStatus icon={<Database size={18} />} label="Price sources" value={String(status.priceSourceCount)} />
          <InlineStatus icon={<Database size={18} />} label="Internal price snaps" value={String(status.realInternalPriceSnapshots)} />
          <InlineStatus icon={<Database size={18} />} label="Real price snaps" value={String(status.realPriceSnapshots)} />
          <InlineStatus icon={<Database size={18} />} label="Mock price snaps" value={String(status.mockPriceSnapshots)} />
          <InlineStatus icon={<Database size={18} />} label="Real offers" value={String(status.realOffers)} />
          <InlineStatus icon={<Database size={18} />} label="Mock offers" value={String(status.mockOffers)} />
        </div>
        <div className="mt-4 rounded-md border border-radar-amber/30 bg-radar-amber/10 p-4 text-sm leading-6 text-radar-amber">
          <p className="font-semibold text-white">Mock price cleanup is guarded.</p>
          <p className="mt-2">
            Preview reports exactly what would be removed. Run requires the confirmation phrase and deletes only mock
            price offers, mock price snapshots and mock price sources.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <AdminActionButton
            endpoint="/api/admin/prices/mock-cleanup/preview"
            method="GET"
            label="Preview mock cleanup"
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/mock-cleanup/run"
            label="Run mock cleanup"
            body={{ confirm: "DELETE_MOCK_PRICE_DATA_ONLY" }}
            editableBody
            requireSecret
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <AdminActionButton
            endpoint="/api/admin/prices/manual-offer"
            label="Add manual offer"
            body={{
              steamAppId: 570,
              storeName: "Steam",
              storeType: "official",
              price: 0,
              regularPrice: 0,
              currency: "PLN",
              externalUrl: "https://store.steampowered.com/app/570",
              region: "PL",
              drm: "Steam",
              isOfficialStore: true,
              available: true
            }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/import-json"
            label="Import JSON offers"
            body={{
              sourceName: "manual-json-import",
              offers: [
                {
                  steamAppId: 570,
                  storeName: "Steam",
                  storeType: "official",
                  price: 0,
                  regularPrice: 0,
                  currency: "PLN",
                  externalUrl: "https://store.steampowered.com/app/570",
                  region: "PL",
                  drm: "Steam",
                  isOfficialStore: true,
                  available: true
                }
              ]
            }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/import-csv"
            label="Import CSV offers"
            body={{
              sourceName: "manual-csv-import",
              csv: "steamAppId,storeName,storeType,price,regularPrice,currency,externalUrl,region,drm,isOfficialStore,available\n570,Steam,official,0,0,PLN,https://store.steampowered.com/app/570,PL,Steam,true,true"
            }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/snapshot"
            label="Snapshot Dota 2 price"
            body={{ steamAppId: 570, sourceName: "manual-admin" }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/recalculate"
            label="Recalculate price snapshots"
            requireSecret
          />
        </div>
        <div className="mt-4 rounded-md border border-radar-amber/30 bg-radar-amber/10 p-4 text-sm leading-6 text-radar-amber">
          <p className="font-semibold text-white">Legacy external providers are disabled.</p>
          <p className="mt-2">
            GG.deals, ITAD and CheapShark are not used by active price refreshes. The app does not bypass Cloudflare,
            scrape protected HTML, use browser cookies, Playwright, Puppeteer or proxy workarounds.
          </p>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">GOG Connector</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Backend-only store connector for the internal GameValue Price API. It uses public GOG JSON endpoints in small
          batches, stores only parsed JSON price data and keeps uncertain matches as manual-review suggestions.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InlineStatus icon={<ShoppingCart size={18} />} label="Enabled" value={status.gogEnabled ? "true" : "false"} />
          <InlineStatus icon={<Database size={18} />} label="Country" value={status.gogCountryCode} />
          <InlineStatus icon={<Database size={18} />} label="Currency" value={status.gogCurrency} />
          <InlineStatus icon={<Database size={18} />} label="Catalog entries" value={String(status.gogCatalogEntries)} />
          <InlineStatus icon={<Database size={18} />} label="Mappings" value={String(status.gogMappings)} />
          <InlineStatus icon={<ShoppingCart size={18} />} label="GOG offers" value={String(status.gogOfferCount)} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last GOG sync"
            value={status.lastGogSync ? formatDate(status.lastGogSync) : "n/a"}
          />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last GOG price"
            value={status.lastGogPriceRefresh ? formatDate(status.lastGogPriceRefresh) : "n/a"}
          />
        </div>
        {status.lastGogError ? (
          <p className="mt-4 rounded-md border border-radar-red/30 bg-radar-red/10 p-3 text-sm leading-6 text-radar-red">
            {status.lastGogError.message}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <AdminActionButton
            endpoint="/api/admin/gog/catalog/search"
            label="Search GOG catalog"
            body={{ query: "witcher", limit: 10 }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/gog/resolve-game"
            label="Resolve game to GOG"
            body={{ gameId: "cyberpunk-2077", limit: 10 }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/gog/mappings"
            label="Map Cyberpunk to GOG"
            body={{
              gameId: "cyberpunk-2077",
              gogProductId: "2093619782",
              externalSlug: "cyberpunk_2077",
              confidence: "manual"
            }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/gog/prices/test"
            label="Test GOG price"
            body={{ gogProductId: "2093619782", externalSlug: "cyberpunk_2077", countryCode: "PL", currency: "PLN" }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/gog/prices/refresh"
            label="Refresh mapped GOG prices"
            body={{ mode: "mapped-games", gameIds: ["cyberpunk-2077"], limit: 1 }}
            editableBody
            requireSecret
          />
        </div>
        <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
          Set `GOG_ENABLED=true` only after `GOG_API_BASE_URL`, `GOG_CATALOG_BASE_URL`, `GOG_COUNTRY_CODE`,
          `GOG_CURRENCY` and `GOG_REQUEST_LIMIT_PER_HOUR` are configured. Keep refresh limits small; do not run mass
          syncs.
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">Steam Store Price Connector</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Experimental backend-only connector for Steam Store JSON appdetails. It stores only parsed JSON from official
          Steam Store responses and is disabled until `STEAM_STORE_PRICE_ENABLED=true`.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InlineStatus
            icon={<ShoppingCart size={18} />}
            label="Enabled"
            value={status.steamStorePriceEnabled ? "true" : "false"}
          />
          <InlineStatus icon={<Database size={18} />} label="Country" value={status.steamStoreCountryCode} />
          <InlineStatus icon={<Database size={18} />} label="Currency" value={status.steamStoreCurrency} />
          <InlineStatus icon={<Database size={18} />} label="Max per run" value={String(status.steamStoreMaxPerRun)} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Cache TTL"
            value={`${status.steamStoreCacheTtlMinutes} min`}
          />
          <InlineStatus icon={<ShoppingCart size={18} />} label="Offers" value={String(status.steamStoreOfferCount)} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Snapshots"
            value={String(status.steamStorePriceSnapshotCount)}
          />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last refresh"
            value={status.lastSteamStorePriceRefresh ? formatDate(status.lastSteamStorePriceRefresh) : "n/a"}
          />
        </div>
        {status.lastSteamStorePriceError ? (
          <p className="mt-4 rounded-md border border-radar-red/30 bg-radar-red/10 p-3 text-sm leading-6 text-radar-red">
            {status.lastSteamStorePriceError.message}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <AdminActionButton
            endpoint="/api/admin/steam-store-prices/test"
            label="Test Dota 2 Steam price"
            body={{ steamAppId: 570, countryCode: "PL", currency: "PLN" }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/steam-store-prices/refresh"
            label="Dry run Dota 2 Steam price"
            body={{ steamAppIds: [570], limit: 1, dryRun: true }}
            editableBody
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/steam-store-prices/refresh"
            label="Dry run imported Steam prices"
            body={{ limit: 5, dryRun: true }}
            editableBody
            requireSecret
          />
        </div>
        <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
          Suggested envs: `STEAM_STORE_PRICE_ENABLED=false`, `STEAM_STORE_COUNTRY=PL`,
          `STEAM_STORE_CURRENCY=PLN`, `STEAM_STORE_API_BASE_URL=https://store.steampowered.com/api`,
          `STEAM_STORE_PRICE_CACHE_TTL_MINUTES=360`, `STEAM_STORE_PRICE_MAX_PER_RUN=20`.
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">Steam catalog status</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Manual admin actions only. Set `ADMIN_API_SECRET` in Vercel, redeploy, then paste it into the local
          `x-admin-secret` field before running a small sync. Do not run large syncs during normal user traffic.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InlineStatus icon={<Database size={18} />} label="Catalog entries" value={String(steamStatus.steamCatalogEntryCount)} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last sync"
            value={steamStatus.lastSteamCatalogSync ? formatDate(steamStatus.lastSteamCatalogSync) : "n/a"}
          />
          <InlineStatus
            icon={<Database size={18} />}
            label="Next cursor"
            value={steamStatus.nextSteamCatalogStartAfterAppId ? String(steamStatus.nextSteamCatalogStartAfterAppId) : "start"}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InlineStatus
            icon={<AlertTriangle size={18} />}
            label="Last error"
            value={steamStatus.lastSteamCatalogError ? formatDate(steamStatus.lastSteamCatalogError.createdAt) : "none"}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <AdminActionButton
            endpoint="/api/admin/steam-catalog/sync"
            label="Dry run next 100"
            body={{ dryRun: true, maxPages: 1, maxResults: 100, startAfterAppId: nextSteamCatalogStartAfterAppId }}
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/steam-catalog/sync"
            label="Sync next 100"
            body={{ dryRun: false, maxPages: 1, maxResults: 100, startAfterAppId: nextSteamCatalogStartAfterAppId }}
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/player-counts/refresh"
            label="Refresh top players"
            body={{ mode: "top", limit: 25 }}
            requireSecret
          />
        </div>
        {steamStatus.lastSteamCatalogError ? (
          <p className="mt-4 rounded-md border border-radar-red/30 bg-radar-red/10 p-3 text-sm leading-6 text-radar-red">
            {steamStatus.lastSteamCatalogError.message}
          </p>
        ) : null}
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">Import starter games</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Imports a capped starter list from the synced Steam catalog and optionally refreshes current players.
          Missing catalog entries are reported per game; the batch does not stop on one failure.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InlineStatus icon={<Database size={18} />} label="Imported games" value={String(status.importedGameCount)} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last player refresh"
            value={status.lastPlayerCountRefresh ? formatDate(status.lastPlayerCountRefresh) : "n/a"}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <AdminActionButton
            endpoint="/api/admin/games/bulk-import"
            label="Import starter 20"
            body={{ steamAppIds: starterSteamAppIds, refreshPlayers: true, limit: 20 }}
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/player-counts/refresh"
            label="Refresh imported players"
            body={{ mode: "all-imported", limit: 20 }}
            requireSecret
          />
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">Games in data layer</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Game</th>
                <th className="py-2">Price</th>
                <th className="py-2">Players</th>
                <th className="py-2">Score</th>
                <th className="py-2">Last snapshot</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {gameRows.map(({ game, summary }) => {
                const priceSource =
                  summary?.latestPrice?.sourceConfidence ?? summary?.bestOffer?.sourceConfidence ?? "no-price-data";
                const priceDataSource = summary?.latestPrice?.source ?? summary?.bestOffer?.source ?? null;
                const priceSourceName = summary?.latestPrice?.sourceName ?? summary?.bestOffer?.sourceName ?? null;

                return (
                  <tr key={game.id} className="text-slate-300">
                    <td className="py-3">
                      <Link href={`/games/${game.id}`} className="font-medium text-white hover:text-radar-cyan">
                        {game.title}
                      </Link>
                    </td>
                    <td className="py-3">
                      <span>{formatPrice(summary?.bestOffer?.price ?? summary?.latestPrice?.price)}</span>
                      <p className="mt-1 text-xs text-slate-500">{formatSourceConfidence(priceSource, priceDataSource, priceSourceName)}</p>
                    </td>
                    <td className="py-3">{formatNumber(summary?.latestPlayers?.playersOnline)}</td>
                    <td className="py-3">{summary?.score.score ?? "n/a"}</td>
                    <td className="py-3">
                      {summary?.latestPrice ? formatDate(summary.latestPrice.capturedAt) : "n/a"}
                    </td>
                    <td className="py-3">
                      <RefreshButton gameId={game.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-radar-amber" aria-hidden />
          <h2 className="text-lg font-semibold text-white">Integration logs</h2>
        </div>
        <div className="space-y-3">
          {status.integrationLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white">{log.service}</span>
                <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{log.level}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{log.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="surface rounded-lg p-4">
      <div className="mb-3 text-radar-cyan">{icon}</div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InlineStatus({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-radar-cyan">{icon}</div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function formatSourceConfidence(status: string, source: string | null, sourceName: string | null): string {
  if (source === "gog" || sourceName === "gog") {
    return "GameValue / GOG";
  }
  if (source === "steam-store" || sourceName === "steam-store") {
    return "GameValue / Steam Store";
  }
  if (status === "internal-real") {
    return "GameValue internal";
  }
  if (status === "experimental-store-api") {
    return "Experimental store API";
  }
  if (status === "internal-mock") {
    return "Demo/mock seed";
  }
  if (status === "external-legacy") {
    return "External legacy";
  }
  return "No price data";
}
