"use client";

import { Download, ExternalLink, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatNumber } from "@/lib/format";
import type { ApiGameSearchResult, ApiImportGameResponse } from "@shared/api-types";

export function SearchResultsGrid({ results }: { results: ApiGameSearchResult[] }): React.ReactElement {
  const groups = [
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
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{group.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.results.map((result) => (
              <SearchResultCard key={`${result.kind}-${result.game.steamAppId}`} result={result} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SearchResultCard({ result }: { result: ApiGameSearchResult }): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openOrImport(): Promise<void> {
    setError(null);

    if (result.summary) {
      router.push(`/games/${result.summary.game.id}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/games/import", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ steamAppId: result.game.steamAppId })
      });
      const body = (await response.json()) as ApiImportGameResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : `Import failed with HTTP ${response.status}.`);
      }

      router.push(`/games/${(body as ApiImportGameResponse).gameId}`);
      router.refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Nie udało się zaimportować gry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="surface overflow-hidden rounded-lg">
      <button type="button" onClick={() => void openOrImport()} className="block w-full text-left" disabled={loading}>
        <img src={result.game.coverUrl} alt="" className="h-28 w-full object-cover" loading="lazy" />
      </button>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 font-semibold text-white">{result.game.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${sourceClass(result)}`}>
              {sourceLabel(result)}
            </span>
            {result.importable ? (
              <span className="rounded-md border border-radar-amber/30 bg-radar-amber/10 px-2 py-1 text-xs font-semibold text-radar-amber">
                do importu
              </span>
            ) : null}
          </div>
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
        <button
          type="button"
          onClick={() => void openOrImport()}
          disabled={loading}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-radar-cyan px-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {result.importable ? <Download size={16} aria-hidden /> : <ExternalLink size={16} aria-hidden />}
          {loading ? "Importuję..." : result.importable ? "Importuj i otwórz" : "Otwórz szczegóły"}
        </button>
        {error ? <p className="text-xs leading-5 text-radar-red">{error}</p> : null}
      </div>
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
