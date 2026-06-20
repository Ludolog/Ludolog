import { Activity, ShoppingCart, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber, formatPrice } from "@/format";
import type { ApiTopGamesResponse } from "@shared/api-types";

export function TopGamesView({
  onOpenGame
}: {
  onOpenGame: (gameId: string) => void;
}): React.ReactElement {
  const [data, setData] = useState<ApiTopGamesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setData(await apiClient.getTopGames(100));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać TOP 100.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <LoadingState label="Ładowanie TOP 100" />;
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Brak danych TOP 100."} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
            <Trophy size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-white">TOP 100 gier</h1>
            <p className="text-sm text-slate-400">Steam players, Steam Store ceny i GameValue Score.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Coverage label="Player count" value={`${data.coverage.withPlayerCount}/${data.coverage.topTrackedCount}`} />
        <Coverage label="Steam cena" value={`${data.coverage.withSteamPrice}/${data.coverage.topTrackedCount}`} />
        <Coverage label="Świeże ceny" value={`${data.coverage.withFreshSteamPrice}/${data.coverage.topTrackedCount}`} />
        <Coverage label="Brak ceny" value={String(data.coverage.noPriceCount)} />
      </section>

      <section className="space-y-3">
        {data.items.map((game) => (
          <button
            key={game.steamAppId}
            type="button"
            onClick={() => {
              if (game.gameId) {
                onOpenGame(game.gameId);
              }
            }}
            disabled={!game.gameId}
            className="surface flex w-full items-center gap-3 rounded-lg p-3 text-left disabled:opacity-70"
          >
            {game.coverUrl ? <img src={game.coverUrl} alt="" className="h-14 w-24 rounded-md object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">
                #{game.rank} {game.title}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Activity size={13} />
                  {formatNumber(game.currentPlayers)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShoppingCart size={13} />
                  {game.bestSteamPrice === null ? "Brak ceny" : formatPrice(game.bestSteamPrice, game.currency ?? "PLN")}
                </span>
              </div>
            </div>
            <span className="rounded-md border border-radar-violet/30 bg-radar-violet/10 px-2 py-1 text-xs font-semibold text-radar-violet">
              {game.gameValueScore ?? "-"}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

function Coverage({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="surface rounded-lg p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
