import { CheckCircle2, Server, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiClientError, apiClient, describeApiClientError } from "@/api/client";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber, formatShortDate } from "@/format";
import type { ApiAdminStatus } from "@shared/api-types";

export function DiagnosticsView(): React.ReactElement {
  const [status, setStatus] = useState<ApiAdminStatus | null>(null);
  const [apiError, setApiError] = useState<ApiClientError | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    setApiError(null);
    try {
      setStatus(await apiClient.getAdminStatus());
    } catch (loadError) {
      setStatus(null);
      setApiError(loadError instanceof ApiClientError ? loadError : null);
      setError(describeApiClientError(loadError));
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
    return (
      <div className="space-y-4">
        <DiagnosticsHeader ok={false} />
        <ErrorState message={error ?? "Brak odpowiedzi backendu."} onRetry={load} />
        <ErrorDetails error={apiError} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DiagnosticsHeader ok />

      <section className="grid grid-cols-2 gap-3">
        <Metric label="Backend" value="OK" />
        <Metric label="Mode" value={status.mode.toUpperCase()} />
        <Metric label="Games" value={formatNumber(status.gameCount)} />
        <Metric label="Offers" value={formatNumber(status.offerCount)} />
        <Metric label="Alerts" value={formatNumber(status.alertCount)} />
        <Metric label="Price snapshots" value={formatNumber(status.priceSnapshotCount)} />
        <Metric label="Steam catalog" value={formatNumber(status.steamCatalogEntryCount)} />
        <Metric label="Imported games" value={formatNumber(status.importedGameCount)} />
        <Metric label="Last catalog sync" value={status.lastSteamCatalogSync ? formatShortDate(status.lastSteamCatalogSync) : "n/a"} />
        <Metric label="Last player refresh" value={status.lastPlayerCountRefresh ? formatShortDate(status.lastPlayerCountRefresh) : "n/a"} />
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

function DiagnosticsHeader({ ok }: { ok: boolean }): React.ReactElement {
  const runtime = apiClient.getRuntimeInfo();

  return (
    <section className="surface rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-lg border ${
            ok
              ? "border-radar-green/35 bg-radar-green/10 text-radar-green"
              : "border-radar-red/35 bg-radar-red/10 text-radar-red"
          }`}
        >
          {ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
        </span>
        <div>
          <h1 className="text-xl font-semibold text-white">Diagnostics</h1>
          <p className="text-sm text-slate-400">API base URL: {apiClient.baseUrl}</p>
          <p className="text-xs text-slate-500">Status backendu: {ok ? "OK" : "blad polaczenia"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs text-slate-400">
        <Detail label="window.location.origin" value={runtime.origin} />
        <Detail label="window.location.href" value={runtime.href} />
        <Detail label="navigator.userAgent" value={runtime.userAgent} />
        <Detail label="Capacitor platform" value={runtime.platform} />
        <Detail label="HTTP transport" value={runtime.transport} />
      </div>
    </section>
  );
}

function ErrorDetails({ error }: { error: ApiClientError | null }): React.ReactElement | null {
  if (!error) {
    return null;
  }

  return (
    <section className="surface rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white">Szczegoly bledu API</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        <Detail label="Typ" value={error.type} />
        <Detail label="HTTP status" value={error.status === undefined ? "n/a" : String(error.status)} />
        <Detail label="Base URL" value={error.baseUrl} />
        <Detail label="Endpoint" value={error.endpoint} />
        <Detail label="URL" value={error.url} />
        <Detail label="Komunikat" value={error.message} />
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <p className="break-words">
      <span className="font-semibold text-white">{label}:</span> {value}
    </p>
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
