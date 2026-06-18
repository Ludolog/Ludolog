"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

export function SearchBox({ compact = false }: { compact?: boolean }): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length > 0) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "w-full" : "w-full max-w-2xl"}>
      <div className="flex gap-2 rounded-lg border border-radar-cyan/25 bg-radar-panel p-2 shadow-glow">
        <label className="sr-only" htmlFor="game-search">
          Search game
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-black/20 px-3">
          <Search size={18} className="shrink-0 text-radar-cyan" aria-hidden />
          <input
            id="game-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cyberpunk 2077, Terraria, Elden Ring..."
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-radar-cyan px-4 text-sm font-semibold text-slate-950 transition hover:bg-radar-green"
        >
          <Search size={16} aria-hidden />
          Search
        </button>
      </div>
    </form>
  );
}

