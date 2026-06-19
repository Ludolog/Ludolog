import Link from "next/link";
import { Bell, Star } from "lucide-react";

import { WatchlistRemoveButton } from "@/components/forms/watchlist-remove-button";
import { ScoreBadge } from "@/components/score-badge";
import { formatNumber, formatPrice } from "@/lib/format";
import { repositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function WatchlistPage(): Promise<React.ReactElement> {
  const [items, alerts] = await Promise.all([
    repositories.watchlist.list(),
    repositories.alerts.list()
  ]);

  return (
    <div className="space-y-6">
      <section className="surface rounded-lg p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-violet/35 bg-radar-violet/10 text-radar-violet">
            <Star size={20} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-white">Watchlist</h1>
            <p className="text-sm text-slate-400">Obserwowane gry, progi cenowe i miejsce pod alerty.</p>
          </div>
        </div>
      </section>

      {items.length > 0 ? (
        <div className="grid gap-4">
          {items.map((item) => {
            const summary = item.summary;
            if (!summary) {
              return null;
            }
            return (
              <article key={item.id} className="surface rounded-lg p-4">
                <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-center">
                  <Link href={`/games/${summary.game.id}`}>
                    <img
                      src={summary.game.coverUrl}
                      alt={`${summary.game.title} cover`}
                      className="h-24 w-full rounded-lg object-cover md:w-44"
                    />
                  </Link>
                  <div className="space-y-3">
                    <div>
                      <Link href={`/games/${summary.game.id}`} className="text-lg font-semibold text-white hover:text-radar-cyan">
                        {summary.game.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-400">
                        Target: {formatPrice(item.targetPrice)} Â· Current:{" "}
                        {formatPrice(summary.bestOffer?.price ?? summary.latestPrice?.price)} Â· Low:{" "}
                        {formatPrice(summary.latestPrice?.historicalLow)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                      <span>{formatNumber(summary.latestPlayers?.playersOnline)} players</span>
                      <span>{summary.latestPrice?.discountPercent ?? 0}% discount</span>
                    </div>
                    <ScoreBadge score={summary.score} />
                  </div>
                  <WatchlistRemoveButton itemId={item.id} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface rounded-lg p-6 text-sm text-slate-300">Watchlist is empty.</div>
      )}

      <section className="surface rounded-lg p-5">
        <div className="mb-4 flex items-center gap-2">
          <Bell size={18} className="text-radar-green" aria-hidden />
          <h2 className="text-lg font-semibold text-white">Price alerts</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-white">{alert.gameId}</p>
              <p className="mt-1 text-sm text-slate-400">
                Threshold: {formatPrice(alert.thresholdPrice)} Â· {alert.isActive ? "Active" : "Triggered"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

