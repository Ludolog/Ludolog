import { notFound } from "next/navigation";
import { Activity, BadgePercent, Calendar, Hash, ShoppingCart } from "lucide-react";

import { PriceChart } from "@/components/charts/price-chart";
import { PlayerChart } from "@/components/charts/player-chart";
import { AlertForm } from "@/components/forms/alert-form";
import { RefreshButton } from "@/components/forms/refresh-button";
import { WatchlistButton } from "@/components/forms/watchlist-button";
import { ScoreBadge } from "@/components/score-badge";
import { formatNumber, formatPrice } from "@/lib/format";
import { recommendationLabel } from "@/lib/services/deal-score-service";
import { gameSearchService } from "@/lib/services/game-search-service";

export const dynamic = "force-dynamic";

type GamePageProps = {
  params: Promise<{ id: string }>;
};

export default async function GamePage({ params }: GamePageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const profile = await gameSearchService.getProfile(id);

  if (!profile) {
    notFound();
  }

  const { game, latestPrice, latestPlayers, bestOffer, score } = profile;
  const factors = Object.entries(score.factors);
  const priceSource = latestPrice?.sourceConfidence ?? bestOffer?.sourceConfidence ?? "no-price-data";

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface overflow-hidden rounded-lg">
          <img src={game.coverUrl} alt={`${game.title} cover`} className="h-64 w-full object-cover" />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {game.genres.map((genre) => (
                <span key={genre} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="surface rounded-lg p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">{game.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{game.description}</p>
            </div>
            <ScoreBadge score={score} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={<ShoppingCart size={18} />} label="Best price" value={formatPrice(bestOffer?.price ?? latestPrice?.price)} />
            <Metric icon={<BadgePercent size={18} />} label="Historical low" value={formatPrice(profile.historicalLow)} />
            <Metric icon={<Activity size={18} />} label="Players online" value={formatNumber(latestPlayers?.playersOnline)} />
            <Metric icon={<Hash size={18} />} label="Steam App ID" value={String(game.steamAppId)} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase text-slate-500">Recommendation</p>
              <p className="mt-1 text-lg font-semibold text-white">{recommendationLabel(score.recommendation)}</p>
              <p className="mt-2 text-sm text-slate-400">{score.reason}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase text-slate-500">Price distance</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {profile.priceDeltaPercent === null ? "Brak danych" : `${profile.priceDeltaPercent}% above low`}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Current discount: {latestPrice?.discountPercent ?? 0}% from base price.
              </p>
              {priceSource === "internal-mock" ? (
                <p className="mt-3 rounded-md border border-radar-amber/30 bg-radar-amber/10 px-3 py-2 text-xs leading-5 text-radar-amber">
                  Price data is demo/mock seed until GameValue Price API receives tracked offers.
                </p>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">{sourceConfidenceLabel(priceSource)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <WatchlistButton gameId={game.id} />
            <RefreshButton gameId={game.id} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white">Historia ceny</h2>
          <PriceChart data={profile.priceHistory} />
        </div>
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white">Historia popularnoĹ›ci</h2>
          <PlayerChart data={profile.playerHistory} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white">Store offers</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Store</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Discount</th>
                  <th className="py-2">DRM</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {profile.offers.map((offer) => (
                  <tr key={offer.id} className="text-slate-300">
                    <td className="py-3 font-medium text-white">
                      {offer.externalUrl ?? offer.url ? (
                        <a
                          href={offer.externalUrl ?? offer.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-radar-cyan"
                        >
                          {offer.storeName}
                        </a>
                      ) : (
                        offer.storeName
                      )}
                    </td>
                    <td className="py-3">{formatPrice(offer.price, offer.currency)}</td>
                    <td className="py-3">{offer.discountPercent}%</td>
                    <td className="py-3">{offer.drm}</td>
                    <td className="py-3">{offer.isOfficial ? "Official" : "Adapter-ready"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface rounded-lg p-5">
            <h2 className="text-lg font-semibold text-white">GameValue factors</h2>
            <div className="mt-4 space-y-3">
              {factors.map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>{key}</span>
                    <span>{value}/100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-md bg-white/10">
                    <div className="h-full rounded-md bg-radar-cyan" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface rounded-lg p-5">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Calendar size={18} className="text-radar-green" aria-hidden />
              <h2 className="text-lg font-semibold">Price alert</h2>
            </div>
            <AlertForm gameId={game.id} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="mb-2 text-radar-cyan">{icon}</div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function sourceConfidenceLabel(source: string): string {
  if (source === "internal-real") {
    return "GameValue internal price data";
  }
  if (source === "internal-mock") {
    return "Demo/mock price data";
  }
  if (source === "external-legacy") {
    return "External legacy price data";
  }
  return "No tracked price data";
}
