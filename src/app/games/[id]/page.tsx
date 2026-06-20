import { notFound } from "next/navigation";
import { Activity, BadgePercent, Calendar, Hash, ShoppingCart } from "lucide-react";

import { PriceChart } from "@/components/charts/price-chart";
import { PlayerChart } from "@/components/charts/player-chart";
import { AlertForm } from "@/components/forms/alert-form";
import { RefreshButton } from "@/components/forms/refresh-button";
import { WatchlistButton } from "@/components/forms/watchlist-button";
import { ScoreBadge } from "@/components/score-badge";
import { formatNumber, formatPrice } from "@/lib/format";
import { GameTagNormalizer } from "@/lib/services/category-service";
import { recommendationLabel } from "@/lib/services/deal-score-service";
import { gameSearchService } from "@/lib/services/game-search-service";
import { isTrustedPriceSource } from "@/lib/services/price-source-utils";

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

  const publicPriceHistory = profile.priceHistory.filter((snapshot) => isTrustedPriceSource(snapshot.source));
  const publicOffers = profile.offers.filter((offer) => isTrustedPriceSource(offer.source));
  const { game, latestPrice, latestPlayers, bestOffer, score } = {
    ...profile,
    latestPrice: profile.latestPrice && isTrustedPriceSource(profile.latestPrice.source) ? profile.latestPrice : null,
    bestOffer: profile.bestOffer && isTrustedPriceSource(profile.bestOffer.source) ? profile.bestOffer : null
  };
  const factors = Object.entries(score.factors);
  const priceSource = latestPrice?.sourceConfidence ?? bestOffer?.sourceConfidence ?? "no-price-data";
  const priceDataSource = latestPrice?.source ?? bestOffer?.source ?? null;
  const priceSourceName = latestPrice?.sourceName ?? bestOffer?.sourceName ?? null;
  const categories = GameTagNormalizer.categoriesForGame(game);
  const trackedPrice = bestOffer?.price ?? latestPrice?.price ?? null;
  const trackedCurrency = bestOffer?.currency ?? latestPrice?.currency ?? "PLN";
  const hasTrackedPrice = trackedPrice !== null;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface overflow-hidden rounded-lg">
          <img src={game.coverUrl} alt={`${game.title} cover`} className="h-64 w-full object-cover" />
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Tagi i kategorie</p>
            <div className="flex flex-wrap gap-2">
              {game.genres.map((genre) => (
                <span key={genre} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
                  {genre}
                </span>
              ))}
              {categories.map((category) => (
                <span key={category} className="rounded-md border border-radar-violet/30 bg-radar-violet/10 px-2 py-1 text-xs font-semibold text-radar-violet">
                  {category}
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
            <Metric
              icon={<ShoppingCart size={18} />}
              label="Najlepsza cena"
              value={hasTrackedPrice ? formatPrice(trackedPrice, trackedCurrency) : "Brak śledzonych cen"}
            />
            <Metric icon={<BadgePercent size={18} />} label="Historyczne minimum" value={formatPrice(profile.historicalLow)} />
            <Metric icon={<Activity size={18} />} label="Gracze online" value={formatNumber(latestPlayers?.playersOnline)} />
            <Metric icon={<Hash size={18} />} label="Steam App ID" value={String(game.steamAppId)} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase text-slate-500">Rekomendacja</p>
              <p className="mt-1 text-lg font-semibold text-white">{recommendationLabel(score.recommendation)}</p>
              <p className="mt-2 text-sm text-slate-400">{score.reason}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase text-slate-500">Pozycja ceny</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {!hasTrackedPrice || profile.priceDeltaPercent === null ? "Brak śledzonych cen" : `${profile.priceDeltaPercent}% powyżej minimum`}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Aktualny rabat: {hasTrackedPrice ? (latestPrice?.discountPercent ?? bestOffer?.discountPercent ?? 0) : 0}% względem ceny bazowej.
              </p>
              {priceSource === "internal-mock" ? (
                <p className="mt-3 rounded-md border border-radar-amber/30 bg-radar-amber/10 px-3 py-2 text-xs leading-5 text-radar-amber">
                  To jest demonstracyjna cena. Nie traktujemy jej jako zaufanej oferty w rankingach produkcyjnych.
                </p>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">{sourceConfidenceLabel(priceSource, priceDataSource, priceSourceName)}</p>
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
          <PriceChart data={publicPriceHistory} />
        </div>
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white">Historia popularności</h2>
          <PlayerChart data={profile.playerHistory} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div className="surface rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white">Ceny śledzone</h2>
          {publicOffers.length === 0 ? (
            <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
              Brak śledzonych cen. Dodaj Steam Store, GOG albo manualne źródło ceny w panelu admina.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Sklep</th>
                    <th className="py-2">Cena</th>
                    <th className="py-2">Rabat</th>
                    <th className="py-2">DRM</th>
                    <th className="py-2">Źródło ceny</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {publicOffers.map((offer) => (
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
                      <td className="py-3">
                        {offer.isOfficial ? "Oficjalny sklep" : "Adapter"}
                        {offer.source === "gog" || offer.sourceName === "gog" ? (
                          <p className="mt-1 text-xs text-radar-violet">GameValue / GOG store API</p>
                        ) : offer.source === "steam-store" || offer.sourceName === "steam-store" ? (
                          <p className="mt-1 text-xs text-radar-cyan">Eksperymentalne źródło Steam Store</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="surface rounded-lg p-5">
            <h2 className="text-lg font-semibold text-white">Czynniki GameValue</h2>
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
              <h2 className="text-lg font-semibold">Alert cenowy</h2>
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
    return "Eksperymentalne źródło sklepu";
  }
  if (confidence === "internal-mock") {
    return "Dane demonstracyjne ceny";
  }
  if (confidence === "external-legacy") {
    return "Legacy provider";
  }
  return "Brak śledzonych cen";
}
