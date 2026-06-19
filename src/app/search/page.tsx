import { Suspense } from "react";

import Link from "next/link";

import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/forms/search-box";
import { SearchResultsGrid } from "@/components/search/search-results-grid";
import { gameSearchService } from "@/lib/services/game-search-service";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; offset?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const parsedOffset = Number(params.offset ?? 0);
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const searchResponse = query
    ? await gameSearchService.searchCatalog(query, { limit: 24, offset })
    : null;
  const searchResults = searchResponse?.results ?? [];
  const previousOffset = searchResponse ? Math.max(0, offset - searchResponse.limit) : null;
  const hasPrevious = searchResponse !== null && offset > 0;
  const hasNext = searchResponse?.nextOffset !== null && searchResponse?.nextOffset !== undefined;
  const recommended = query ? [] : await gameSearchService.bestDeals(8);

  return (
    <div className="space-y-6">
      <div className="surface rounded-lg p-5">
        <h1 className="text-2xl font-semibold text-white">Szukaj gier</h1>
        <div className="mt-4">
          <Suspense fallback={<div className="h-16 rounded-lg bg-radar-panel" />}>
            <SearchBox compact />
          </Suspense>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {query ? `Wyniki dla "${query}"` : "Polecane okazje"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {query
                ? `${searchResponse?.total ?? 0} wyników, pokazuję ${searchResults.length}`
                : `${recommended.length} polecanych gier`}
            </p>
          </div>
        </div>

        {query && searchResults.length > 0 ? (
          <>
            <SearchResultsGrid results={searchResults} />
            {(hasPrevious || hasNext) && searchResponse ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-slate-400">
                  Strona od wyniku {offset + 1} z {searchResponse.total}
                </span>
                <div className="flex gap-2">
                  {hasPrevious ? (
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&offset=${previousOffset}`}
                      className="rounded-md border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white hover:border-radar-cyan/50"
                    >
                      Poprzednie
                    </Link>
                  ) : null}
                  {hasNext ? (
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&offset=${searchResponse.nextOffset}`}
                      className="rounded-md bg-radar-cyan px-4 py-2 text-sm font-semibold text-slate-950"
                    >
                      Następne
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : !query && recommended.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((summary) => (
              <GameCard key={summary.game.id} summary={summary} />
            ))}
          </div>
        ) : (
          <div className="surface rounded-lg p-6 text-sm text-slate-300">Brak wyników dla tej frazy.</div>
        )}
      </section>
    </div>
  );
}

