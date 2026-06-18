import { Suspense } from "react";

import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/forms/search-box";
import { gameSearchService } from "@/lib/services/game-search-service";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = query ? await gameSearchService.search(query) : await gameSearchService.bestDeals(8);

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
            <p className="mt-1 text-sm text-slate-400">{results.length} games found</p>
          </div>
        </div>

        {results.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {results.map((summary) => (
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

