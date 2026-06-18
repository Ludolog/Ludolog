import { Activity, BadgePercent, ShoppingCart } from "lucide-react";

import { formatNumber, formatPrice } from "@/format";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { ApiGameSummary } from "@shared/api-types";

export function GameCard({
  summary,
  onOpen
}: {
  summary: ApiGameSummary;
  onOpen: (gameId: string) => void;
}): React.ReactElement {
  const price = summary.bestOffer?.price ?? summary.latestPrice?.price;

  return (
    <button
      type="button"
      onClick={() => onOpen(summary.game.id)}
      className="surface w-full overflow-hidden rounded-lg text-left active:scale-[0.99]"
    >
      <img src={summary.game.coverUrl} alt="" className="h-28 w-full object-cover" loading="lazy" />
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-semibold text-white">{summary.game.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{summary.game.platform}</p>
            </div>
            <span className="rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-xs font-semibold text-radar-green">
              -{summary.latestPrice?.discountPercent ?? 0}%
            </span>
          </div>
          <ScoreBadge score={summary.score} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
          <Metric icon={<ShoppingCart size={15} />} value={formatPrice(price)} label={summary.bestOffer?.storeName ?? "Offer"} />
          <Metric icon={<Activity size={15} />} value={formatNumber(summary.latestPlayers?.playersOnline)} label="online" />
          <Metric icon={<BadgePercent size={15} />} value={formatPrice(summary.latestPrice?.historicalLow)} label="low" />
        </div>
      </div>
    </button>
  );
}

function Metric({
  icon,
  value,
  label
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}): React.ReactElement {
  return (
    <div>
      <div className="mb-1 text-radar-cyan">{icon}</div>
      <span className="block truncate font-semibold text-white">{value}</span>
      <span>{label}</span>
    </div>
  );
}
