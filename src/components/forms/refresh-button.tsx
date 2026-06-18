"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshButton({ gameId }: { gameId: string }): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function refresh(): Promise<void> {
    setLoading(true);
    await fetch(`/api/games/${gameId}/refresh`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-radar-cyan/35 bg-radar-cyan/10 px-3 py-2 text-sm font-semibold text-radar-cyan transition hover:bg-radar-cyan/20 disabled:opacity-60"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
      Refresh
    </button>
  );
}

