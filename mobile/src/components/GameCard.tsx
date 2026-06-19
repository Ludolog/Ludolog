import { Activity, BadgePercent, ShoppingCart } from "lucide-react";

import { formatNumber, formatPrice } from "@/format";
import { GGDealsAttribution } from "@/components/GGDealsAttribution";
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
  const priceSource = summary.latestPrice?.source ?? summary.bestOffer?.source ?? "mock";
  const storeType = summary.bestOffer?.storeType ?? summary.latestPrice?.storeType ?? "unknown";
  const hasGGDealsPrice = summary.latestPrice?.source === "ggdeals" || summary.bestOffer?.source === "ggdeals";
  const ggDealsUrl = summary.bestOffer?.externalUrl ?? summary.bestOffer?.url ?? summary.latestPrice?.externalUrl;

  return (
    <article className="surface w-full overflow-hidden rounded-lg">
      <button type="button" onClick={() => onOpen(summary.game.id)} className="w-full text-left active:scale-[0.99]">
        <img src={summary.game.coverUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-white">{summary.game.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{summary.game.platform}</p>
              </div>
              <span className="rounded-md border border-radar-green/30 bg-radar-green/10 px-2 py-1 text-xs font-semibold text-radar-green">
                -{summary.latestPrice?.discountPercent ?? 0}%
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-radar-cyan/30 bg-radar-cyan/10 px-2.5 py-1 text-xs font-semibold text-radar-cyan">
                <Activity size={14} />
                {formatNumber(summary.latestPlayers?.playersOnline)} online
              </span>
              <ScoreBadge score={summary.score} />
              <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${priceSourceClass(priceSource)}`}>
                {priceSourceLabel(priceSource)}
              </span>
              <span className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {storeTypeLabel(storeType)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
            <Metric icon={<ShoppingCart size={15} />} value={formatPrice(price)} label={summary.bestOffer?.storeName ?? "Offer"} />
            <Metric icon={<Activity size={15} />} value={formatNumber(summary.latestPlayers?.playersOnline)} label="online" />
            <Metric icon={<BadgePercent size={15} />} value={formatPrice(summary.latestPrice?.historicalLow)} label="low" />
          </div>
        </div>
      </button>
      {hasGGDealsPrice ? <GGDealsAttribution className="px-4 pb-4" href={ggDealsUrl} /> : null}
    </article>
  );
}

function priceSourceLabel(source: string): string {
  if (source === "ggdeals") {
    return "GG.deals";
  }
  if (source === "mock") {
    return "Mock price";
  }
  return "Price API";
}

function priceSourceClass(source: string): string {
  if (source === "ggdeals") {
    return "border-radar-green/30 bg-radar-green/10 text-radar-green";
  }
  if (source === "mock") {
    return "border-radar-amber/30 bg-radar-amber/10 text-radar-amber";
  }
  return "border-radar-cyan/30 bg-radar-cyan/10 text-radar-cyan";
}

function storeTypeLabel(type: string): string {
  if (type === "official") {
    return "Official";
  }
  if (type === "keyshop") {
    return "Keyshop";
  }
  if (type === "marketplace") {
    return "Marketplace";
  }
  return "Store";
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
