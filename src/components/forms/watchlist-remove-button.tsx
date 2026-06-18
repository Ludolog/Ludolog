"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function WatchlistRemoveButton({ itemId }: { itemId: string }): React.ReactElement {
  const router = useRouter();

  async function remove(): Promise<void> {
    await fetch(`/api/watchlist/${itemId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-radar-red/35 bg-radar-red/10 px-3 py-2 text-sm font-semibold text-radar-red transition hover:bg-radar-red/20"
    >
      <Trash2 size={16} aria-hidden />
      Remove
    </button>
  );
}

