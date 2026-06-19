import Link from "next/link";
import { AlertTriangle, Database, RefreshCw, Server, ShoppingCart } from "lucide-react";

import { RefreshButton } from "@/components/forms/refresh-button";
import { AdminActionButton } from "@/components/forms/admin-action-button";
import { GGDealsAttribution } from "@/components/ggdeals-attribution";
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
            <p className="text-sm text-slate-400">PodglÄ…d danych, snapshotĂłw i statusu adapterĂłw.</p>
          </div>
        </div>
      </section>

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
        <StatusCard icon={<ShoppingCart size={18} />} label="GG.deals key" value={status.hasGGDealsApiKey ? "SET" : "MISSING"} />
        <StatusCard icon={<ShoppingCart size={18} />} label="GG.deals status" value={formatGGDealsStatus(status.ggdealsStatus)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Real price snaps" value={String(status.realPriceSnapshots)} />
        <StatusCard icon={<ShoppingCart size={18} />} label="Real offers" value={String(status.realOffers)} />
        <StatusCard icon={<RefreshCw size={18} />} label="Player snapshots" value={String(status.playerSnapshotCount)} />
        <StatusCard icon={<RefreshCw size={18} />} label="Real player snaps" value={String(status.realPlayerSnapshots)} />
        <StatusCard icon={<RefreshCw size={18} />} label="Mock player snaps" value={String(status.mockPlayerSnapshots)} />
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">Price Provider Status</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Backend-only price refresh. GG.deals key stays in Vercel env; Android and web clients call only our API.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <InlineStatus icon={<ShoppingCart size={18} />} label="Provider" value={status.priceProvider} />
          <InlineStatus icon={<ShoppingCart size={18} />} label="Mode" value={status.priceMode} />
          <InlineStatus icon={<ShoppingCart size={18} />} label="GG.deals key" value={status.hasGGDealsApiKey ? "configured" : "missing"} />
          <InlineStatus icon={<AlertTriangle size={18} />} label="GG.deals status" value={formatGGDealsStatus(status.ggdealsStatus)} />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last price refresh"
            value={status.lastPriceRefresh ? formatDate(status.lastPriceRefresh) : "n/a"}
          />
          <InlineStatus
            icon={<RefreshCw size={18} />}
            label="Last GG.deals check"
            value={status.lastGGDealsCheck ? formatDate(status.lastGGDealsCheck) : "n/a"}
          />
          <InlineStatus icon={<Database size={18} />} label="Real price snaps" value={String(status.realPriceSnapshots)} />
          <InlineStatus icon={<Database size={18} />} label="Mock price snaps" value={String(status.mockPriceSnapshots)} />
          <InlineStatus icon={<Database size={18} />} label="Real offers" value={String(status.realOffers)} />
          <InlineStatus icon={<Database size={18} />} label="Mock offers" value={String(status.mockOffers)} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <AdminActionButton
            endpoint="/api/admin/prices/refresh"
            label="Refresh imported prices"
            body={{ mode: "imported", limit: 10 }}
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/refresh"
            label="Dry run selected prices"
            body={{ steamAppIds: [570, 730], limit: 2, dryRun: true }}
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/refresh-best"
            label="Refresh best value prices"
            body={{ mode: "best", limit: 10 }}
            requireSecret
          />
          <AdminActionButton
            endpoint="/api/admin/prices/provider-diagnostics"
            label="Diagnose GG.deals API"
            body={{ provider: "ggdeals", steamAppIds: [570, 730], dryRun: true }}
            requireSecret
          />
        </div>
        {status.ggdealsStatus === "blocked_by_cloudflare" ? (
          <div className="mt-4 rounded-md border border-radar-amber/30 bg-radar-amber/10 p-4 text-sm leading-6 text-radar-amber">
            <p className="font-semibold text-white">GG.deals API access is blocked by Cloudflare from the backend host.</p>
            <p className="mt-2">
              Contact GG.deals support with the sanitized diagnostics output. Mention that GameValue Radar uses only the
              official JSON API from a Vercel backend, keeps the API key server-side, displays GG.deals attribution links,
              and does not scrape HTML or use browser sessions.
            </p>
          </div>
        ) : null}
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
                const hasGGDealsPrice = summary?.latestPrice?.source === "ggdeals" || summary?.bestOffer?.source === "ggdeals";
                const ggDealsUrl = summary?.bestOffer?.externalUrl ?? summary?.bestOffer?.url ?? summary?.latestPrice?.externalUrl;

                return (
                  <tr key={game.id} className="text-slate-300">
                    <td className="py-3">
                      <Link href={`/games/${game.id}`} className="font-medium text-white hover:text-radar-cyan">
                        {game.title}
                      </Link>
                    </td>
                    <td className="py-3">
                      <span>{formatPrice(summary?.bestOffer?.price ?? summary?.latestPrice?.price)}</span>
                      {hasGGDealsPrice ? <GGDealsAttribution className="mt-1" href={ggDealsUrl} /> : null}
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

function formatGGDealsStatus(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

