import { Activity, Download, Search } from "lucide-react";
import { FormEvent, useState } from "react";

import { apiClient, describeApiClientError } from "@/api/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber, formatPrice } from "@/format";
import type { ApiGameSearchResult } from "@shared/api-types";

export function SearchView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiGameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingSteamAppId, setImportingSteamAppId] = useState<number | null>(null);
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
      setError(describeApiClientError(searchError));
    } finally {
      setLoading(false);
    }
  }

  async function openResult(result: ApiGameSearchResult): Promise<void> {
    if (result.summary) {
      onOpenGame(result.summary.game.id);
      return;
    }

    setImportingSteamAppId(result.game.steamAppId);
    setError(null);
    try {
      const response = await apiClient.importGame({ steamAppId: result.game.steamAppId });
      onOpenGame(response.summary.game.id);
    } catch (importError) {
      setError(describeApiClientError(importError));
    } finally {
      setImportingSteamAppId(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void search();
  }

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-4">
        <h1 className="text-xl font-semibold text-white">Search Steam catalog</h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Results combine your database with a larger fallback Steam catalog.
        </p>
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="mobile-search">
            Search game
          </label>
          <input
            id="mobile-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cyberpunk, Dota, Palworld..."
            className="min-h-12 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-radar-cyan"
          />
          <button className="grid min-h-12 w-12 place-items-center rounded-md bg-radar-cyan text-slate-950" type="submit">
            <Search size={19} />
          </button>
        </form>
      </section>

      {loading ? <LoadingState label="Searching catalog" /> : null}
      {error ? <ErrorState message={error} onRetry={search} /> : null}
      {!loading && !error && searched && results.length === 0 ? <EmptyState message="No games matched this query." /> : null}
      {!loading && !error
        ? results.map((result) => (
            <SearchResultCard
              key={`${result.kind}-${result.game.steamAppId}`}
              importing={importingSteamAppId === result.game.steamAppId}
              result={result}
              onOpen={() => void openResult(result)}
            />
          ))
        : null}
      {!searched ? <EmptyState message="Type a game name to search local data and the Steam fallback catalog." /> : null}
    </div>
  );
}

function SearchResultCard({
  importing,
  onOpen,
  result
}: {
  importing: boolean;
  onOpen: () => void;
  result: ApiGameSearchResult;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={importing}
      className="surface flex w-full gap-3 rounded-lg p-3 text-left disabled:opacity-70"
    >
      <img src={result.game.coverUrl} alt="" className="h-20 w-24 shrink-0 rounded-md object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="line-clamp-2 font-semibold text-white">{result.game.title}</h2>
            <p className="mt-1 text-xs text-slate-400">{result.importable ? "Steam catalog" : "In library"}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 text-xs font-semibold text-radar-cyan">
            {result.importable ? <Download size={13} /> : <Search size={13} />}
            {importing ? "Importing" : result.importable ? "Import" : "Open"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-radar-green">
            <Activity size={13} />
            {formatNumber(result.currentPlayers)}
          </span>
          <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
            {formatPrice(result.currentPrice)}
          </span>
          {result.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
