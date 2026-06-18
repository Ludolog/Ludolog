import { Search } from "lucide-react";
import { FormEvent, useState } from "react";

import { apiClient } from "@/api/client";
import { GameCard } from "@/components/GameCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import type { ApiGameSummary } from "@shared/api-types";

export function SearchView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiGameSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const response = await apiClient.searchGames(trimmed);
      setResults(response.results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Nie udało się wyszukać gry.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void search();
  }

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-4">
        <h1 className="text-xl font-semibold text-white">Search</h1>
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="mobile-search">
            Search game
          </label>
          <input
            id="mobile-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cyberpunk, Terraria..."
            className="min-h-12 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-radar-cyan"
          />
          <button className="grid min-h-12 w-12 place-items-center rounded-md bg-radar-cyan text-slate-950" type="submit">
            <Search size={19} />
          </button>
        </form>
      </section>

      {loading ? <LoadingState label="Szukam gier" /> : null}
      {error ? <ErrorState message={error} onRetry={search} /> : null}
      {!loading && !error && searched && results.length === 0 ? <EmptyState message="Brak wyników dla tej frazy." /> : null}
      {!loading && !error && results.map((summary) => <GameCard key={summary.game.id} summary={summary} onOpen={onOpenGame} />)}
      {!searched ? <EmptyState message="Wpisz nazwę gry, aby pobrać wyniki z backendu." /> : null}
    </div>
  );
}
