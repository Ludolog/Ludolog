"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function AdminActionButton({
  body,
  editableBody = false,
  endpoint,
  label,
  requireSecret = false
}: {
  body?: unknown;
  editableBody?: boolean;
  endpoint: string;
  label: string;
  requireSecret?: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [bodyText, setBodyText] = useState(body === undefined ? "" : JSON.stringify(body, null, 2));

  async function run(): Promise<void> {
    setLoading(true);
    setResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (requireSecret && secret.trim().length > 0) {
        headers["x-admin-secret"] = secret.trim();
      }
      const requestBody = editableBody ? parseBodyText(bodyText) : body;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: requestBody === undefined ? undefined : JSON.stringify(requestBody)
      });
      const payload = (await response.json()) as unknown;
      setResult(response.ok ? compactJson(payload) : `Error ${response.status}: ${compactJson(payload)}`);
      router.refresh();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {requireSecret ? (
        <input
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="x-admin-secret"
          className="min-h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-radar-cyan"
        />
      ) : null}
      {editableBody ? (
        <textarea
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          rows={8}
          className="min-h-32 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-radar-cyan"
        />
      ) : null}
      <button
        type="button"
        onClick={run}
        disabled={loading || (requireSecret && secret.trim().length === 0)}
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

function parseBodyText(value: string): unknown {
  if (!value.trim()) {
    return undefined;
  }
  return JSON.parse(value);
}
