import Link from "next/link";
import { Activity, BadgePercent, Clock3, Database, ShieldAlert, ShoppingCart, Trophy } from "lucide-react";

import { formatNumber, formatPrice } from "@/lib/format";
import { topGamesService } from "@/lib/services/top-games-service";

export const dynamic = "force-dynamic";

export default async function TopGamesPage(): Promise<React.ReactElement> {
  const data = await topGamesService.list({ limit: 100, sort: "players" });
  const coverage = data.coverage;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-radar-cyan">
            <Trophy size={20} aria-hidden />
            <span className="text-sm font-semibold uppercase">TOP 100 Steam</span>
          </div>
          <h1 className="text-3xl font-semibold text-white">TOP 100 gier</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Produkcyjny zakres GameValue Radar: wybrana setka gier Steam z player countami, cenami Steam Store,
            świeżością danych i scoringiem zakupowym.
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-white hover:border-radar-cyan/40 hover:text-radar-cyan"
        >
          Importuj brakujące gry
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CoverageCard icon={<Database size={18} />} label="Zaimportowane" value={`${coverage.importedCount}/${coverage.topTrackedCount}`} />
        <CoverageCard icon={<Activity size={18} />} label="Real player count" value={`${coverage.withPlayerCount}/${coverage.topTrackedCount}`} />
        <CoverageCard icon={<ShoppingCart size={18} />} label="Cena Steam" value={`${coverage.withSteamPrice}/${coverage.topTrackedCount}`} />
        <CoverageCard icon={<Clock3 size={18} />} label="Świeże ceny" value={`${coverage.withFreshSteamPrice}/${coverage.topTrackedCount}`} />
        <CoverageCard icon={<BadgePercent size={18} />} label="Pełny score" value={`${coverage.fullScoreCount}/${coverage.topTrackedCount}`} />
        <CoverageCard icon={<ShieldAlert size={18} />} label="No-data gracze" value={String(coverage.noPlayerDataCount)} />
        <CoverageCard icon={<ShoppingCart size={18} />} label="Brak ceny" value={String(coverage.noPriceDataCount)} />
        <CoverageCard icon={<ShieldAlert size={18} />} label="Public mock" value={String(coverage.mockPublicDataCount)} />
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="grid grid-cols-[56px_1.5fr_0.9fr_0.8fr_0.9fr_0.8fr] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>#</span>
          <span>Gra</span>
          <span>Gracze</span>
          <span>Cena Steam</span>
          <span>Freshness</span>
          <span>Score</span>
        </div>
        <div className="divide-y divide-white/10">
          {data.items.map((item) => (
            <article
              key={item.steamAppId}
              className="grid grid-cols-[56px_1.5fr_0.9fr_0.8fr_0.9fr_0.8fr] items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="text-slate-500">{item.rank}</span>
              <div className="flex min-w-0 items-center gap-3">
                {item.coverUrl ? <img src={item.coverUrl} alt="" className="h-10 w-20 rounded-md object-cover" loading="lazy" /> : null}
                <div className="min-w-0">
                  {item.gameId ? (
                    <Link href={`/games/${item.gameId}`} className="line-clamp-1 font-semibold text-white hover:text-radar-cyan">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="line-clamp-1 font-semibold text-white">{item.title}</p>
                  )}
                  <p className="text-xs text-slate-500">Steam App ID {item.steamAppId}</p>
                </div>
              </div>
              <span className="font-semibold text-white">{item.currentPlayers === null ? "brak danych" : formatNumber(item.currentPlayers)}</span>
              <span className="font-semibold text-radar-green">
                {item.bestSteamPrice === null ? "brak" : formatPrice(item.bestSteamPrice, item.currency ?? "PLN")}
              </span>
              <span className="text-slate-300">
                {freshnessLabel(item.playerFreshness)} / {freshnessLabel(item.priceFreshness)}
              </span>
              <span className="inline-flex w-fit items-center gap-1 rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2 py-1 font-semibold text-radar-cyan">
                <BadgePercent size={14} aria-hidden />
                {item.gameValueScore ?? "-"}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CoverageCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.ReactElement {
  return (
    <div className="surface rounded-lg p-4">
      <div className="mb-2 text-radar-cyan">{icon}</div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function freshnessLabel(value: string): string {
  if (value === "fresh") {
    return "świeże";
  }
  if (value === "stale") {
    return "stale";
  }
  return "brak";
}
