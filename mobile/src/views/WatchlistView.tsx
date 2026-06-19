import { useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import { ScoreBadge } from "@/components/ScoreBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber, formatPrice } from "@/format";
import type { ApiWatchlistItem } from "@shared/api-types";

export function WatchlistView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [items, setItems] = useState<ApiWatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getWatchlist();
      setItems(response.results);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać watchlisty.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <section className="surface rounded-lg p-4">
        <h1 className="text-xl font-semibold text-white">Watchlist</h1>
        <p className="mt-1 text-sm text-slate-400">Gry obserwowane przez konto demonstracyjne.</p>
      </section>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState message="Watchlista jest pusta." /> : null}
      {!loading &&
        !error &&
        items.map((item) => {
          if (!item.summary) {
            return null;
          }

          const summary = item.summary;
          return (
            <article key={item.id} className="surface w-full rounded-lg">
            <button
              type="button"
              onClick={() => onOpenGame(summary.game.id)}
              className="w-full p-4 text-left active:scale-[0.99]"
            >
              <img src={summary.game.coverUrl} alt="" className="mb-4 h-24 w-full rounded-lg object-cover" />
              <h2 className="font-semibold text-white">{summary.game.title}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Target: {formatPrice(item.targetPrice)} · Current: {formatPrice(summary.bestOffer?.price ?? summary.latestPrice?.price)}
              </p>
              <p className="mt-1 text-sm text-slate-400">{formatNumber(summary.latestPlayers?.playersOnline)} players online</p>
              <div className="mt-3">
                <ScoreBadge score={summary.score} />
              </div>
            </button>
            </article>
          );
        })}
    </div>
  );
}
