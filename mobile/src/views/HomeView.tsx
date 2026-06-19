import { Activity, BadgePercent, Radar, Search, TrendingUp } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { apiClient, describeApiClientError } from "@/api/client";
import { GameCard } from "@/components/GameCard";
import { GGDealsAttribution } from "@/components/GGDealsAttribution";
import { EmptyState, ErrorState, SkeletonList } from "@/components/StateViews";
import { formatNumber, formatPrice } from "@/format";
import type { ApiAdminStatus, ApiGameSearchResult, ApiGameSummary, ApiStatsGame, ApiStatsOverview } from "@shared/api-types";

export function HomeView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [deals, setDeals] = useState<ApiGameSummary[]>([]);
  const [overview, setOverview] = useState<ApiStatsOverview | null>(null);
  const [status, setStatus] = useState<ApiAdminStatus | null>(null);
  const [query, setQuery] = useState("");
  const [quickResults, setQuickResults] = useState<ApiGameSearchResult[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [bestDeals, adminStatus, stats] = await Promise.all([
        apiClient.getBestDeals(4),
        apiClient.getAdminStatus(),
        apiClient.getStatsOverview()
      ]);
      setDeals(bestDeals.results);
      setStatus(adminStatus);
      setOverview(stats);
    } catch (loadError) {
      setError(describeApiClientError(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function quickSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setQuickResults([]);
      return;
    }

    setQuickLoading(true);
    try {
      const response = await apiClient.searchGames(trimmed);
      setQuickResults(response.results.slice(0, 3));
    } catch (searchError) {
      setError(describeApiClientError(searchError));
    } finally {
      setQuickLoading(false);
    }
  }

  async function openSearchResult(result: ApiGameSearchResult): Promise<void> {
    if (result.summary) {
      onOpenGame(result.summary.game.id);
      return;
    }

    const imported = await apiClient.importGame({ steamAppId: result.game.steamAppId });
    onOpenGame(imported.summary.game.id);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <SkeletonList count={4} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
            <Radar size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white">GameValue Radar</h1>
            <p className="truncate text-sm text-slate-400">Steam activity, prices and buy signals.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SmallMetric icon={<BadgePercent size={17} />} label="Mode" value={status?.mode.toUpperCase() ?? "API"} />
          <SmallMetric icon={<Activity size={17} />} label="Games" value={formatNumber(status?.gameCount)} />
          <SmallMetric icon={<TrendingUp size={17} />} label="Players" value={formatNumber(overview?.topPlayers[0]?.currentPlayers)} />
        </div>
        {overview ? (
          <p className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300">
            {statsModeLabel(overview.mode)} - catalog {formatNumber(overview.sourceCounts.steamCatalogEntries)} - real snaps{" "}
            {formatNumber(overview.sourceCounts.realPlayerSnapshots)}
          </p>
        ) : null}
      </section>

      <section className="surface rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white">Quick search</h2>
        <form onSubmit={quickSearch} className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cyberpunk, Valheim, Dota..."
            className="min-h-12 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-radar-cyan"
          />
          <button type="submit" className="grid min-h-12 w-12 place-items-center rounded-md bg-radar-cyan text-slate-950">
            <Search size={18} />
          </button>
        </form>
        {quickLoading ? <p className="mt-3 text-xs text-slate-400">Searching Steam catalog...</p> : null}
        {quickResults.length > 0 ? (
          <div className="mt-3 space-y-2">
            {quickResults.map((result) => (
              <button
                key={`${result.kind}-${result.game.steamAppId}`}
                type="button"
                onClick={() => void openSearchResult(result)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{result.game.title}</span>
                <span className="text-xs text-radar-cyan">{result.importable ? "Import" : "Open"}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {overview ? (
        <>
          <StatsStrip title="Top Steam now" games={overview.topPlayers.slice(0, 3)} onOpenGame={onOpenGame} />
          <StatsStrip title="Trending" games={overview.trending.slice(0, 3)} onOpenGame={onOpenGame} />
          <StatsStrip title="Best value" games={overview.bestValue.slice(0, 3)} onOpenGame={onOpenGame} />
        </>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Best deals</h2>
        {deals.length > 0 ? (
          deals.map((summary) => <GameCard key={summary.game.id} summary={summary} onOpen={onOpenGame} />)
        ) : (
          <EmptyState message="No offers available." />
        )}
      </section>
    </div>
  );
}

function statsModeLabel(mode: ApiStatsOverview["mode"]): string {
  if (mode === "real") {
    return "Real data";
  }
  if (mode === "mixed") {
    return "Mixed data";
  }
  return "Mock fallback";
}

function StatsStrip({
  games,
  onOpenGame,
  title
}: {
  games: ApiStatsGame[];
  onOpenGame: (gameId: string) => void;
  title: string;
}): React.ReactElement {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-2">
        {games.map((game) => (
          <article key={game.id} className="surface rounded-lg">
            <button
              type="button"
              onClick={() => onOpenGame(game.id)}
              className="flex min-h-16 w-full items-center justify-between gap-3 px-3 py-2 text-left"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{game.title}</p>
                <p className="text-xs text-slate-400">
                  {formatNumber(game.currentPlayers)} online - {formatPrice(game.currentPrice)}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-radar-violet/30 bg-radar-violet/10 px-2 py-1 text-xs font-semibold text-radar-violet">
                {game.gameValueScore}/100
              </span>
            </button>
            {game.priceSource === "ggdeals" ? <GGDealsAttribution className="px-3 pb-3" href={game.priceExternalUrl} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SmallMetric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-radar-cyan">{icon}</div>
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
