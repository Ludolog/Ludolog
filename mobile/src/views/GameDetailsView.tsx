import { ArrowLeft, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import { PlayerChart, PriceChart } from "@/components/MobileCharts";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { formatNumber, formatPrice, recommendationLabel } from "@/format";
import type { ApiGameProfile } from "@shared/api-types";

export function GameDetailsView({
  gameId,
  onBack
}: {
  gameId: string;
  onBack: () => void;
}): React.ReactElement {
  const [profile, setProfile] = useState<ApiGameProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchStatus, setWatchStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getGameProfile(gameId);
      setProfile(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać profilu gry.");
    } finally {
      setLoading(false);
    }
  }

  async function addToWatchlist(): Promise<void> {
    setWatchStatus("saving");
    try {
      await apiClient.addToWatchlist(gameId);
      setWatchStatus("saved");
    } catch {
      setWatchStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, [gameId]);

  if (loading) {
    return <LoadingState label="Ładowanie profilu gry" />;
  }

  if (error || !profile) {
    return <ErrorState message={error ?? "Brak danych profilu."} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-radar-cyan">
        <ArrowLeft size={18} />
        Wróć
      </button>

      <section className="surface overflow-hidden rounded-lg">
        <img src={profile.game.coverUrl} alt="" className="h-40 w-full object-cover" />
        <div className="space-y-4 p-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{profile.game.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{profile.game.description}</p>
          </div>
          <ScoreBadge score={profile.score} />
          <button
            type="button"
            onClick={addToWatchlist}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-radar-violet px-4 text-sm font-semibold text-white"
          >
            <Star size={18} />
            {watchStatus === "saved" ? "Dodano do watchlisty" : watchStatus === "saving" ? "Dodaję..." : "Dodaj do watchlisty"}
          </button>
          {watchStatus === "error" ? <p className="text-sm text-radar-red">Nie udało się dodać gry do watchlisty.</p> : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Metric label="Best price" value={formatPrice(profile.bestOffer?.price ?? profile.latestPrice?.price)} />
        <Metric label="Historical low" value={formatPrice(profile.historicalLow)} />
        <Metric label="Players" value={formatNumber(profile.latestPlayers?.playersOnline)} />
        <Metric label="Steam App ID" value={String(profile.game.steamAppId)} />
      </section>

      <section className="surface rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Player count source</p>
            <p className="mt-1 text-lg font-semibold text-white">{playerSourceLabel(profile.latestPlayers?.source)}</p>
            <p className="mt-1 text-xs text-slate-400">
              Last refreshed: {profile.latestPlayers ? new Date(profile.latestPlayers.capturedAt).toLocaleString("pl-PL") : "n/a"}
            </p>
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-4">
        <p className="text-xs uppercase text-slate-500">Recommendation</p>
        <p className="mt-1 text-lg font-semibold text-white">{recommendationLabel(profile.score.recommendation)}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{profile.score.reason}</p>
      </section>

      <section className="surface rounded-lg p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Historia ceny</h2>
        <PriceChart data={profile.priceHistory} />
      </section>

      <section className="surface rounded-lg p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Historia graczy</h2>
        <PlayerChart data={profile.playerHistory} />
      </section>

      <section className="surface rounded-lg p-4">
        <h2 className="text-lg font-semibold text-white">Oferty sklepów</h2>
        <div className="mt-3 space-y-3">
          {profile.offers.map((offer) => (
            <div key={offer.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{offer.storeName}</span>
                <span className="text-radar-green">{formatPrice(offer.price, offer.currency)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {offer.discountPercent}% · {offer.drm} · {offer.isOfficial ? "official" : "adapter-ready"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function playerSourceLabel(source: string | undefined): string {
  if (source === "steam-api") {
    return "Real Steam";
  }
  if (source === "mock") {
    return "Mock";
  }
  return "Cached";
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="surface rounded-lg p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
