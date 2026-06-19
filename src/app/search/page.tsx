import { Suspense } from "react";

import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/forms/search-box";
import { formatNumber } from "@/lib/format";
import { gameSearchService } from "@/lib/services/game-search-service";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const searchResults = query ? await gameSearchService.searchCatalog(query) : [];
  const recommended = query ? [] : await gameSearchService.bestDeals(8);

  return (
    <div className="space-y-6">
      <div className="surface rounded-lg p-5">
        <h1 className="text-2xl font-semibold text-white">Search games</h1>
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
              {query ? `Results for "${query}"` : "Recommended deals"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {query ? `${searchResults.length} games found` : `${recommended.length} recommended games`}
            </p>
          </div>
        </div>

        {query && searchResults.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {searchResults.map((result) => (
              <article key={`${result.kind}-${result.game.steamAppId}`} className="surface overflow-hidden rounded-lg">
                <img src={result.game.coverUrl} alt="" className="h-28 w-full object-cover" loading="lazy" />
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="line-clamp-2 font-semibold text-white">{result.game.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {result.importable ? "Steam catalog - importable from API" : "In GameValue library"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 font-semibold text-radar-cyan">
                      {formatNumber(result.currentPlayers)} online
                    </span>
                    {result.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : !query && recommended.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((summary) => (
              <GameCard key={summary.game.id} summary={summary} />
            ))}
          </div>
        ) : (
          <div className="surface rounded-lg p-6 text-sm text-slate-300">No games matched this query.</div>
        )}
      </section>
    </div>
  );
}

