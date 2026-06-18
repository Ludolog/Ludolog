import { Suspense } from "react";
import { Activity, BadgePercent, Radar, TrendingUp } from "lucide-react";

import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/forms/search-box";
import { formatNumber } from "@/lib/format";
import { gameSearchService } from "@/lib/services/game-search-service";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.ReactElement> {
  const [bestDeals, activeGames] = await Promise.all([
    gameSearchService.bestDeals(4),
    gameSearchService.mostActive(4)
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
              <p className="text-sm text-slate-400">Aktualne okazje, aktywnoĹ›Ä‡ graczy i scoring zakupowy w jednym panelu.</p>
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
            <p className="text-xs uppercase text-slate-500">Tracked players</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatNumber(totalPlayers)}</p>
          </div>
          <div className="surface rounded-lg p-4">
            <TrendingUp className="mb-3 text-radar-violet" size={20} aria-hidden />
            <p className="text-xs uppercase text-slate-500">Mock snapshots</p>
            <p className="mt-1 text-2xl font-semibold text-white">14 days</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Najlepsze okazje</h2>
          <span className="rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-xs font-semibold text-radar-green">
            Best deal
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
          <h2 className="text-xl font-semibold text-white">Najbardziej aktywne gry</h2>
          <span className="rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 text-xs font-semibold text-radar-cyan">
            High activity
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activeGames.map((summary) => (
            <GameCard key={summary.game.id} summary={summary} />
          ))}
        </div>
      </section>
    </div>
  );
}

