import { useEffect, useState } from "react";

import { apiClient, describeApiClientError } from "@/api/client";
import { GameCard } from "@/components/GameCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import type { ApiGameSummary } from "@shared/api-types";

export function DealsView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [deals, setDeals] = useState<ApiGameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getBestDeals(10);
      setDeals(response.results);
    } catch (loadError) {
      setError(describeApiClientError(loadError));
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
        <h1 className="text-xl font-semibold text-white">Ceny śledzone</h1>
        <p className="mt-1 text-sm text-slate-400">Tylko ceny z wewnętrznych, GOG albo Steam Store źródeł.</p>
      </section>
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && deals.length === 0 ? (
        <EmptyState message="Brak śledzonych cen. Dodaj źródło ceny w panelu admina." />
      ) : null}
      {!loading && !error
        ? deals.map((summary) => <GameCard key={summary.game.id} summary={summary} onOpen={onOpenGame} />)
        : null}
    </div>
  );
}
