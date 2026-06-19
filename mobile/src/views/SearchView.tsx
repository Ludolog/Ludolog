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
  const [importSuccess, setImportSuccess] = useState<{ created: boolean; gameId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);
    setImportSuccess(null);
    setSearched(true);
    try {
      const response = await apiClient.searchGames(trimmed, { limit: 25 });
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
    setImportSuccess(null);
    try {
      const response = await apiClient.importGame({ steamAppId: result.game.steamAppId });
      setResults((current) =>
        current.map((item) =>
          item.game.steamAppId === response.steamAppId
            ? {
                ...item,
                kind: "library",
                importable: false,
                source: "database",
                game: response.summary.game,
                summary: response.summary,
                currentPlayers: response.summary.latestPlayers?.playersOnline ?? item.currentPlayers,
                currentPrice: response.summary.latestPrice?.price ?? response.summary.bestOffer?.price ?? item.currentPrice,
                historicalLow: response.summary.latestPrice?.historicalLow ?? item.historicalLow,
                tags: response.summary.game.genres
              }
            : item
        )
      );
      setImportSuccess({
        created: response.created,
        gameId: response.gameId,
        title: response.summary.game.title
      });
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

  const groupedResults = [
    {
      id: "library",
      title: "W bibliotece",
      results: results.filter((result) => !result.importable)
    },
    {
      id: "steam-catalog",
      title: "Katalog Steam",
      results: results.filter((result) => result.importable && result.source === "steam-catalog")
    },
    {
      id: "mock-catalog",
      title: "Fallback demo",
      results: results.filter((result) => result.importable && result.source === "mock-catalog")
    }
  ].filter((group) => group.results.length > 0);

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-4">
        <h1 className="text-xl font-semibold text-white">Szukaj gier</h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Wyniki pokazują najpierw bibliotekę, potem katalog Steam i dopiero fallback.
        </p>
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="mobile-search">
            Szukaj gry
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

      {loading ? <LoadingState label="Szukam w katalogu" /> : null}
      {importSuccess ? (
        <section className="surface rounded-lg border border-radar-green/25 p-4">
          <p className="text-sm font-semibold text-radar-green">
            {importSuccess.created ? "Zaimportowano" : "Już w bibliotece"}: {importSuccess.title}
          </p>
          <button
            type="button"
            onClick={() => onOpenGame(importSuccess.gameId)}
            className="mt-3 min-h-11 rounded-md bg-radar-cyan px-4 text-sm font-semibold text-slate-950"
          >
            Otwórz szczegóły
          </button>
        </section>
      ) : null}
      {error ? <ErrorState message={error} onRetry={search} /> : null}
      {!loading && !error && searched && results.length === 0 ? <EmptyState message="Brak wyników dla tej frazy." /> : null}
      {!loading && !error
        ? groupedResults.map((group) => (
            <section key={group.id} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{group.title}</h2>
              {group.results.map((result) => (
                <SearchResultCard
                  key={`${result.kind}-${result.game.steamAppId}`}
                  importing={importingSteamAppId === result.game.steamAppId}
                  result={result}
                  onOpen={() => void openResult(result)}
                />
              ))}
            </section>
          ))
        : null}
      {!searched ? <EmptyState message="Wpisz nazwę gry, żeby przeszukać bibliotekę i katalog Steam." /> : null}
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
    <article className="surface rounded-lg">
      <button
        type="button"
        onClick={onOpen}
        disabled={importing}
        className="flex w-full gap-3 p-3 text-left disabled:opacity-70"
      >
        <img src={result.game.coverUrl} alt="" className="h-20 w-24 shrink-0 rounded-md object-cover" loading="lazy" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="line-clamp-2 font-semibold text-white">{result.game.title}</h2>
              <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${sourceClass(result)}`}>
                {sourceLabel(result)}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 text-xs font-semibold text-radar-cyan">
              {result.importable ? <Download size={13} /> : <Search size={13} />}
              {importing ? "Importuję" : result.importable ? "Importuj" : "Otwórz"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-radar-green">
              <Activity size={13} />
              {formatNumber(result.currentPlayers)}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
              {result.currentPrice > 0 ? formatPrice(result.currentPrice) : "Brak śledzonych cen"}
            </span>
            {result.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </button>
    </article>
  );
}

function sourceLabel(result: ApiGameSearchResult): string {
  if (!result.importable) {
    return "W bibliotece";
  }
  if (result.source === "steam-catalog") {
    return "Katalog Steam";
  }
  return "Fallback demo";
}

function sourceClass(result: ApiGameSearchResult): string {
  if (!result.importable) {
    return "border-radar-green/30 bg-radar-green/10 text-radar-green";
  }
  if (result.source === "steam-catalog") {
    return "border-radar-cyan/30 bg-radar-cyan/10 text-radar-cyan";
  }
  return "border-radar-amber/30 bg-radar-amber/10 text-radar-amber";
}
