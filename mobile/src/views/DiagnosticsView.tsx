import { Server } from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber, formatShortDate } from "@/format";
import type { ApiAdminStatus } from "@shared/api-types";

export function DiagnosticsView(): React.ReactElement {
  const [status, setStatus] = useState<ApiAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setStatus(await apiClient.getAdminStatus());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Backend jest niedostępny.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <LoadingState label="Sprawdzam backend" />;
  }

  if (error || !status) {
    return <ErrorState message={error ?? "Brak odpowiedzi backendu."} onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <section className="surface rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-green/35 bg-radar-green/10 text-radar-green">
            <Server size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">Diagnostics</h1>
            <p className="text-sm text-slate-400">Backend: {apiClient.baseUrl}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Metric label="Mode" value={status.mode.toUpperCase()} />
        <Metric label="Games" value={formatNumber(status.gameCount)} />
        <Metric label="Offers" value={formatNumber(status.offerCount)} />
        <Metric label="Alerts" value={formatNumber(status.alertCount)} />
      </section>

      <section className="surface rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white">Integration logs</h2>
        <div className="mt-3 space-y-3">
          {status.integrationLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{log.service}</span>
                <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">{log.level}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-400">{log.message}</p>
              <p className="mt-1 text-xs text-slate-500">{formatShortDate(log.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="surface rounded-lg p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
