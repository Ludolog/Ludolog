"use client";

import { FormEvent, useState } from "react";
import { Bell } from "lucide-react";

export function AlertForm({ gameId }: { gameId: string }): React.ReactElement {
  const [thresholdPrice, setThresholdPrice] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const numericPrice = Number(thresholdPrice);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setStatus("error");
      return;
    }

    setStatus("saving");
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, thresholdPrice: numericPrice })
    });
    setStatus(response.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="threshold-price">
        Price threshold
      </label>
      <input
        id="threshold-price"
        value={thresholdPrice}
        onChange={(event) => setThresholdPrice(event.target.value)}
        inputMode="decimal"
        placeholder="Alert price PLN"
        className="min-h-10 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-radar-cyan"
      />
      <button
        type="submit"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-radar-green px-3 text-sm font-semibold text-slate-950 transition hover:bg-radar-cyan"
      >
        <Bell size={16} aria-hidden />
        {status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Set alert"}
      </button>
    </form>
  );
}

