import Link from "next/link";
import { Activity, BadgePercent, ShoppingCart } from "lucide-react";

import { formatNumber, formatPrice } from "@/lib/format";
import type { GameSummary } from "@/lib/types";
import { ScoreBadge } from "@/components/score-badge";

export function GameCard({ summary }: { summary: GameSummary }): React.ReactElement {
  const { game, latestPrice, latestPlayers, bestOffer } = summary;
  const priceSource = latestPrice?.sourceConfidence ?? bestOffer?.sourceConfidence ?? "no-price-data";
  const priceDataSource = latestPrice?.source ?? bestOffer?.source ?? null;
  const priceSourceName = latestPrice?.sourceName ?? bestOffer?.sourceName ?? null;

  return (
    <article className="surface overflow-hidden rounded-lg transition hover:border-radar-cyan/35 hover:shadow-glow">
      <Link href={`/games/${game.id}`} className="block">
        <img
          src={game.coverUrl}
          alt={`${game.title} cover`}
          className="h-28 w-full object-cover"
          loading="lazy"
        />
      </Link>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/games/${game.id}`} className="line-clamp-2 font-semibold text-white hover:text-radar-cyan">
                {game.title}
              </Link>
              <p className="mt-1 text-xs text-slate-400">{game.platform}</p>
            </div>
            {latestPrice?.discountPercent ? (
              <span className="rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-xs font-semibold text-radar-green">
                -{latestPrice.discountPercent}%
              </span>
            ) : null}
          </div>
          <ScoreBadge score={summary.score} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
          <div>
            <ShoppingCart size={15} className="mb-1 text-radar-cyan" aria-hidden />
            <span className="block font-semibold text-white">{formatPrice(bestOffer?.price ?? latestPrice?.price)}</span>
            <span>{bestOffer?.storeName ?? "Brak oferty"}</span>
          </div>
          <div>
            <Activity size={15} className="mb-1 text-radar-green" aria-hidden />
            <span className="block font-semibold text-white">{formatNumber(latestPlayers?.playersOnline)}</span>
            <span>online</span>
          </div>
          <div>
            <BadgePercent size={15} className="mb-1 text-radar-violet" aria-hidden />
            <span className="block font-semibold text-white">{formatPrice(latestPrice?.historicalLow)}</span>
            <span>minimum</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">{sourceConfidenceLabel(priceSource, priceDataSource, priceSourceName)}</p>
      </div>
    </article>
  );
}

function sourceConfidenceLabel(confidence: string, source: string | null, sourceName: string | null): string {
  if (source === "gog" || sourceName === "gog") {
    return "GameValue / GOG store API";
  }
  if (source === "steam-store" || sourceName === "steam-store") {
    return "Eksperymentalne źródło Steam Store";
  }
  if (confidence === "internal-real") {
    return "GameValue internal";
  }
  if (confidence === "experimental-store-api") {
    return "Eksperymentalne źródło";
  }
  if (confidence === "internal-mock") {
    return "Dane demonstracyjne";
  }
  if (confidence === "external-legacy") {
    return "Legacy provider";
  }
  return "Brak śledzonych cen";
}
