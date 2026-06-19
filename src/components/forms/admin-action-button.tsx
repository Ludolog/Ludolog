"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function AdminActionButton({
  body,
  endpoint,
  label
}: {
  body?: unknown;
  endpoint: string;
  label: string;
}): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run(): Promise<void> {
    setLoading(true);
    setResult(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = (await response.json()) as unknown;
    setResult(response.ok ? compactJson(payload) : `Error ${response.status}: ${compactJson(payload)}`);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-radar-cyan/35 bg-radar-cyan/10 px-3 text-sm font-semibold text-radar-cyan transition hover:bg-radar-cyan/20 disabled:opacity-60"
      >
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
        {loading ? "Working..." : label}
      </button>
      {result ? <p className="break-words text-xs leading-5 text-slate-400">{result}</p> : null}
    </div>
  );
}

function compactJson(value: unknown): string {
  return JSON.stringify(value).slice(0, 280);
}
