"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export const ADMIN_SECRET_STORAGE_KEY = "gamevalue-admin-secret";
export const ADMIN_SECRET_UPDATED_EVENT = "gamevalue-admin-secret-updated";

export function AdminSecretPanel(): React.ReactElement {
  const [secret, setSecret] = useState("");

  useEffect(() => {
    setSecret(window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? "");
  }, []);

  function updateSecret(value: string): void {
    setSecret(value);
    if (value.trim()) {
      window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(ADMIN_SECRET_UPDATED_EVENT));
  }

  return (
    <section className="surface sticky top-3 z-20 rounded-lg p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
            <KeyRound size={18} aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">Admin secret</h2>
            <p className="text-sm text-slate-400">Local browser storage only. Required for write/admin endpoints.</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-xl">
          <input
            type="password"
            value={secret}
            onChange={(event) => updateSecret(event.target.value)}
            placeholder="x-admin-secret"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-radar-cyan"
          />
          <button
            type="button"
            onClick={() => updateSecret("")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-300 transition hover:border-radar-red/40 hover:text-radar-red"
          >
            <Trash2 size={16} aria-hidden />
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
