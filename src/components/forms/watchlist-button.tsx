"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function WatchlistButton({ gameId }: { gameId: string }): React.ReactElement {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function addToWatchlist(): Promise<void> {
    setStatus("saving");

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId })
    });

    setStatus(response.ok ? "saved" : "error");
  }

  return (
    <button
      type="button"
      onClick={addToWatchlist}
      disabled={status === "saving"}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-radar-violet/35 bg-radar-violet/10 px-3 py-2 text-sm font-semibold text-radar-violet transition hover:bg-radar-violet/20 disabled:opacity-60"
    >
      <Star size={16} aria-hidden />
      {status === "saved" ? "Added" : status === "saving" ? "Saving" : "Watch"}
    </button>
  );
}

