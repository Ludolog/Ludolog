import { Activity, BadgePercent, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient, describeApiClientError } from "@/api/client";
import { EmptyState, ErrorState, SkeletonList } from "@/components/StateViews";
import { formatNumber, formatPrice, recommendationClass, recommendationLabel } from "@/format";
import type { ApiStatsGame, ApiStatsOverview } from "@shared/api-types";

export function StatsView({ onOpenGame }: { onOpenGame: (gameId: string) => void }): React.ReactElement {
  const [overview, setOverview] = useState<ApiStatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setOverview(await apiClient.getStatsOverview());
    } catch (loadError) {
      setError(describeApiClientError(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <SkeletonList count={4} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!overview) {
    return <EmptyState message="Brak statystyk." />;
  }

  return (
    <div className="space-y-5">
      <section className="surface rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
            <Activity size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white">Statystyki Steam</h1>
            <p className="truncate text-xs text-slate-400">
              {modeLabel(overview.mode)} - aktualizacja {new Date(overview.updatedAt).toLocaleTimeString("pl-PL")}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <MiniMetric label="Katalog" value={formatNumber(overview.sourceCounts.steamCatalogEntries)} />
          <MiniMetric label="Importowane" value={formatNumber(overview.sourceCounts.importedGames)} />
          <MiniMetric label="Ceny realne" value={formatNumber(overview.sourceCounts.realInternalPriceSnapshots)} />
          <MiniMetric label="GOG" value={formatNumber(overview.sourceCounts.gogOffers)} />
          <MiniMetric label="Steam Store" value={formatNumber(overview.sourceCounts.steamStoreOffers)} />
          <MiniMetric label="Brak cen" value={formatNumber(overview.sourceCounts.gamesWithoutPrices)} />
          <MiniMetric label="Mock ceny" value={formatNumber(overview.sourceCounts.mockPriceSnapshots)} />
          <MiniMetric label="Real snaps" value={formatNumber(overview.sourceCounts.realPlayerSnapshots)} />
        </div>
      </section>

      <StatsSection title="Popularne teraz" icon={<Activity size={17} />} games={overview.topPlayers} onOpenGame={onOpenGame} />
      <StatsSection title="Największy wzrost graczy" icon={<TrendingUp size={17} />} games={overview.trendingUp} onOpenGame={onOpenGame} />
      <StatsSection title="Najlepsza wartość" icon={<BadgePercent size={17} />} games={overview.bestValue} onOpenGame={onOpenGame} />
      <StatsSection title="Największy spadek graczy" icon={<TrendingDown size={17} />} games={overview.trendingDown} onOpenGame={onOpenGame} />
      <StatsSection title="Darmowe gry" icon={<BadgePercent size={17} />} games={overview.freeToPlay} onOpenGame={onOpenGame} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Kategorie</h2>
        {overview.categories.map((category) => (
          <div key={category.id} className="surface rounded-lg p-4">
            <div className="mb-3">
              <h3 className="font-semibold text-white">{category.title}</h3>
              <p className="text-xs leading-5 text-slate-400">{category.description}</p>
            </div>
            <div className="space-y-2">
              {category.games.slice(0, 3).map((game) => (
                <CompactStatsRow key={game.id} game={game} onOpenGame={onOpenGame} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function modeLabel(mode: ApiStatsOverview["mode"]): string {
  if (mode === "real") {
    return "Dane rzeczywiste";
  }
  if (mode === "mixed") {
    return "Dane mieszane";
  }
  return "Dane demonstracyjne";
}

function MiniMetric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <p className="uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function StatsSection({
  games,
  icon,
  onOpenGame,
  title
}: {
  games: ApiStatsGame[];
  icon: React.ReactNode;
  onOpenGame: (gameId: string) => void;
  title: string;
}): React.ReactElement {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-radar-cyan">{icon}</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-3">
        {games.length > 0 ? (
          games.slice(0, 5).map((game) => (
            <StatsGameCard key={game.id} game={game} onOpenGame={onOpenGame} />
          ))
        ) : (
          <EmptyState message={`Brak gier w sekcji: ${title.toLowerCase()}.`} />
        )}
      </div>
    </section>
  );
}

function StatsGameCard({
  game,
  onOpenGame
}: {
  game: ApiStatsGame;
  onOpenGame: (gameId: string) => void;
}): React.ReactElement {
  const isUp = game.playerTrendPercent >= 0;

  return (
    <article className="surface rounded-lg">
      <button
        type="button"
        onClick={() => onOpenGame(game.id)}
        className="flex w-full gap-3 p-3 text-left active:scale-[0.99]"
      >
        <img src={game.coverUrl} alt="" className="h-20 w-24 shrink-0 rounded-md object-cover" loading="lazy" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-semibold leading-snug text-white">{game.title}</h3>
            <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${recommendationClass(game.recommendation)}`}>
              {recommendationLabel(game.recommendation)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-radar-cyan/25 bg-radar-cyan/10 px-2 py-1 font-semibold text-radar-cyan">
              {formatNumber(game.currentPlayers)} online
            </span>
            <span className={`rounded-md border px-2 py-1 font-semibold ${playerSourceClass(game.playerSource)}`}>
              {playerSourceLabel(game.playerSource)}
            </span>
            <span className={`rounded-md border px-2 py-1 font-semibold ${priceSourceClass(game.priceSourceConfidence)}`}>
              {priceSourceLabel(game.priceSourceConfidence, game.priceSource)}
            </span>
            <span className={`rounded-md border px-2 py-1 font-semibold ${isUp ? "border-radar-green/30 bg-radar-green/10 text-radar-green" : "border-radar-red/30 bg-radar-red/10 text-radar-red"}`}>
              {isUp ? "+" : ""}
              {game.playerTrendPercent}%
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
              {game.bestPrice === null ? "Brak śledzonych cen" : formatPrice(game.bestPrice)}
            </span>
            <span className="rounded-md border border-radar-violet/30 bg-radar-violet/10 px-2 py-1 font-semibold text-radar-violet">
              {game.gameValueScore}/100
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function playerSourceLabel(source: ApiStatsGame["playerSource"]): string {
  if (source === "steam-api") {
    return "Real Steam";
  }
  if (source === "mock") {
    return "Demo";
  }
  return "Cache";
}

function playerSourceClass(source: ApiStatsGame["playerSource"]): string {
  if (source === "steam-api") {
    return "border-radar-green/30 bg-radar-green/10 text-radar-green";
  }
  if (source === "mock") {
    return "border-radar-amber/30 bg-radar-amber/10 text-radar-amber";
  }
  return "border-white/10 bg-black/20 text-slate-300";
}

function priceSourceLabel(confidence: ApiStatsGame["priceSourceConfidence"], source: ApiStatsGame["priceSource"]): string {
  if (source === "gog") {
    return "GameValue / GOG";
  }
  if (source === "steam-store") {
    return "Eksperymentalne źródło Steam Store";
  }
  if (confidence === "internal-real") {
    return "GameValue internal";
  }
  if (confidence === "experimental-store-api") {
    return "Eksperymentalne źródło";
  }
  if (confidence === "internal-mock") {
    return "Cena demo";
  }
  if (confidence === "external-legacy") {
    return "Legacy provider";
  }
  return "Brak danych cenowych";
}

function priceSourceClass(source: ApiStatsGame["priceSourceConfidence"]): string {
  if (source === "internal-real") {
    return "border-radar-green/30 bg-radar-green/10 text-radar-green";
  }
  if (source === "experimental-store-api") {
    return "border-radar-cyan/30 bg-radar-cyan/10 text-radar-cyan";
  }
  if (source === "internal-mock") {
    return "border-radar-amber/30 bg-radar-amber/10 text-radar-amber";
  }
  if (source === "external-legacy") {
    return "border-radar-cyan/30 bg-radar-cyan/10 text-radar-cyan";
  }
  return "border-white/10 bg-black/20 text-slate-300";
}

function CompactStatsRow({
  game,
  onOpenGame
}: {
  game: ApiStatsGame;
  onOpenGame: (gameId: string) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onOpenGame(game.id)}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{game.title}</span>
      <span className="text-xs text-radar-cyan">{formatNumber(game.currentPlayers)}</span>
    </button>
  );
}
