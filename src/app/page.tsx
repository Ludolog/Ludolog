import { Suspense } from "react";
import Link from "next/link";
import { Activity, BadgePercent, Layers, Radar } from "lucide-react";

import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/forms/search-box";
import { formatNumber, formatPrice } from "@/lib/format";
import { gameSearchService } from "@/lib/services/game-search-service";
import { statsService } from "@/lib/services/stats-service";
import { topGamesService } from "@/lib/services/top-games-service";
import type { ApiStatsGame } from "@shared/api-types";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.ReactElement> {
  const [bestDeals, activeGames, stats, topGames] = await Promise.all([
    gameSearchService.bestDeals(4),
    gameSearchService.mostActive(4),
    statsService.overview(6),
    topGamesService.list({ limit: 6, sort: "players" })
  ]);
  const topScore = bestDeals[0]?.score.score ?? 0;
  const totalPlayers = activeGames.reduce((sum, summary) => sum + (summary.latestPlayers?.playersOnline ?? 0), 0);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="surface rounded-lg p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
              <Radar size={20} aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">GameValue Radar</h1>
              <p className="text-sm text-slate-400">Aktualne okazje, aktywność graczy i scoring zakupowy w jednym panelu.</p>
            </div>
          </div>
          <Suspense fallback={<div className="h-16 rounded-lg bg-radar-panel" />}>
            <SearchBox />
          </Suspense>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="surface rounded-lg p-4">
            <BadgePercent className="mb-3 text-radar-green" size={20} aria-hidden />
            <p className="text-xs uppercase text-slate-500">Top score</p>
            <p className="mt-1 text-2xl font-semibold text-white">{topScore}/100</p>
          </div>
          <div className="surface rounded-lg p-4">
            <Activity className="mb-3 text-radar-cyan" size={20} aria-hidden />
            <p className="text-xs uppercase text-slate-500">Gracze online</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(totalPlayers)}</p>
          </div>
          <div className="surface rounded-lg p-4">
            <Layers className="mb-3 text-radar-violet" size={20} aria-hidden />
            <p className="text-xs uppercase text-slate-500">Brak cen</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(stats.sourceCounts.gamesWithoutPrices)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">TOP 100 gier</h2>
            <p className="mt-1 text-sm text-slate-400">
              {topGames.coverage.withPlayerCount}/{topGames.coverage.topTrackedCount} z player countem,{" "}
              {topGames.coverage.withSteamPrice}/{topGames.coverage.topTrackedCount} z ceną Steam.
            </p>
          </div>
          <Link
            href="/top-games"
            className="rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-3 py-2 text-sm font-semibold text-radar-cyan"
          >
            Otwórz ranking
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {topGames.items.slice(0, 6).map((game) => (
            <article key={game.steamAppId} className="surface rounded-lg p-4">
              <div className="flex items-center gap-3">
                {game.coverUrl ? <img src={game.coverUrl} alt="" className="h-12 w-24 rounded-md object-cover" loading="lazy" /> : null}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{game.title}</p>
                  <p className="text-xs text-slate-400">{formatNumber(game.currentPlayers)} graczy</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-radar-green">
                  {game.bestSteamPrice === null ? "Brak ceny" : formatPrice(game.bestSteamPrice, game.currency ?? "PLN")}
                </span>
                <span className="rounded-md border border-radar-violet/30 bg-radar-violet/10 px-2 py-1 text-xs font-semibold text-radar-violet">
                  {game.gameValueScore ?? "-"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Najlepsze okazje</h2>
          <span className="rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-xs font-semibold text-radar-green">
            Ceny śledzone
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bestDeals.map((summary) => (
            <GameCard key={summary.game.id} summary={summary} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Dashboard danych</h2>
          <span className="rounded-md border border-radar-violet/30 bg-radar-violet/10 px-2 py-1 text-xs font-semibold text-radar-violet">
            {stats.mode.toUpperCase()}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <StatsPanel title="Popularne teraz" games={stats.topPlayers.slice(0, 4)} />
          <StatsPanel title="Największy wzrost graczy" games={stats.trendingUp.slice(0, 4)} />
          <StatsPanel title="Najlepsza wartość" games={stats.bestValue.slice(0, 4)} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Najbardziej aktywne gry</h2>
          <span className="rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 text-xs font-semibold text-radar-cyan">
            Real player data
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activeGames.map((summary) => (
            <GameCard key={summary.game.id} summary={summary} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Kategorie</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.categories.slice(0, 6).map((category) => (
            <article key={category.id} className="surface rounded-lg p-4">
              <h3 className="font-semibold text-white">{category.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">{category.description}</p>
              <div className="mt-4 space-y-2">
                {category.topGames.slice(0, 3).map((game) => (
                  <div key={game.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-white">{game.title}</span>
                    <span className="text-xs text-radar-cyan">{formatNumber(game.currentPlayers)}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatsPanel({ games, title }: { games: ApiStatsGame[]; title: string }): React.ReactElement {
  return (
    <article className="surface rounded-lg p-4">
      <h3 className="font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {games.map((game) => (
          <div key={game.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{game.title}</p>
              <p className="text-xs text-slate-400">
                {formatNumber(game.currentPlayers)} graczy - {game.playerTrendPercent >= 0 ? "+" : ""}
                {game.playerTrendPercent}%
              </p>
            </div>
            <span className="rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 text-xs font-semibold text-radar-cyan">
              {game.gameValueScore}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

