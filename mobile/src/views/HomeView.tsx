import { Activity, BadgePercent, Radar } from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import { GameCard } from "@/components/GameCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber } from "@/format";
import type { ApiAdminStatus, ApiGameSummary } from "@shared/api-types";

export function HomeView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [deals, setDeals] = useState<ApiGameSummary[]>([]);
  const [status, setStatus] = useState<ApiAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [bestDeals, adminStatus] = await Promise.all([apiClient.getBestDeals(4), apiClient.getAdminStatus()]);
      setDeals(bestDeals.results);
      setStatus(adminStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nieznany błąd połączenia.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
            <Radar size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-white">GameValue Radar</h1>
            <p className="text-sm text-slate-400">Mobilny radar cen i aktywności graczy.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SmallMetric icon={<BadgePercent size={18} />} label="Mode" value={status?.mode.toUpperCase() ?? "API"} />
          <SmallMetric icon={<Activity size={18} />} label="Games" value={formatNumber(status?.gameCount)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Najlepsze okazje</h2>
        {deals.length > 0 ? (
          deals.map((summary) => <GameCard key={summary.game.id} summary={summary} onOpen={onOpenGame} />)
        ) : (
          <EmptyState message="Brak ofert do wyświetlenia." />
        )}
      </section>
    </div>
  );
}

function SmallMetric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-radar-cyan">{icon}</div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
