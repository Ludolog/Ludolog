import type {
  GamePriceSnapshot,
  GameValueResult,
  PlayerCountSnapshot,
  Recommendation,
  ScoreFactors,
  StoreOffer
} from "@/lib/types";

type ScoreInput = {
  latestPrice: GamePriceSnapshot | null;
  priceHistory: GamePriceSnapshot[];
  latestPlayers: PlayerCountSnapshot | null;
  playerHistory: PlayerCountSnapshot[];
  offers: StoreOffer[];
  reviewScore?: number;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculatePricePosition(latestPrice: GamePriceSnapshot | null): number {
  if (!latestPrice) {
    return 0;
  }

  if (latestPrice.price === 0 && latestPrice.historicalLow === 0) {
    return 100;
  }

  if (latestPrice.historicalLow <= 0) {
    return latestPrice.discountPercent > 0 ? 65 : 35;
  }

  const aboveLowPercent = ((latestPrice.price - latestPrice.historicalLow) / latestPrice.historicalLow) * 100;
  return clamp(100 - aboveLowPercent * 1.25);
}

function calculateActivity(latestPlayers: PlayerCountSnapshot | null): number {
  if (!latestPlayers) {
    return 0;
  }

  // Logarithmic normalization rewards active communities without letting very large games dominate the score.
  const normalized = (Math.log10(latestPlayers.playersOnline + 1) / Math.log10(1_000_000)) * 100;
  return clamp(normalized);
}

function calculateTrend(playerHistory: PlayerCountSnapshot[]): number {
  if (playerHistory.length < 2) {
    return 50;
  }

  const sorted = [...playerHistory].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const latest = sorted.at(-1)?.playersOnline ?? 0;
  const previousWindow = sorted.slice(0, Math.max(1, sorted.length - 1));
  const average =
    previousWindow.reduce((total, snapshot) => total + snapshot.playersOnline, 0) / previousWindow.length;

  if (average <= 0) {
    return latest > 0 ? 75 : 45;
  }

  const ratio = latest / average;
  return clamp(50 + (ratio - 1) * 120);
}

function calculateOfferAvailability(offers: StoreOffer[]): number {
  if (offers.length === 0) {
    return 0;
  }

  const officialBonus = offers.some((offer) => offer.isOfficial) ? 18 : 0;
  const competition = clamp(offers.length * 18, 18, 70);
  const bestDiscount = Math.max(...offers.map((offer) => offer.discountPercent));
  return clamp(competition + officialBonus + bestDiscount * 0.2);
}

function recommendationFor(score: number, latestPrice: GamePriceSnapshot | null): Recommendation {
  const closeToHistoricalLow =
    latestPrice !== null &&
    (latestPrice.price === 0 ||
      latestPrice.historicalLow === 0 ||
      latestPrice.price <= latestPrice.historicalLow * 1.08);

  if (score >= 75 || (score >= 68 && closeToHistoricalLow)) {
    return "buy_now";
  }

  if (score >= 55) {
    return "wait";
  }

  return "weak_deal";
}

function reasonFor(recommendation: Recommendation, factors: ScoreFactors): string {
  if (recommendation === "buy_now") {
    return "Cena i aktywność graczy tworzą mocny sygnał zakupowy.";
  }

  if (recommendation === "wait") {
    return "Oferta jest poprawna, ale historia ceny sugeruje przestrzeń na lepszą promocję.";
  }

  if (factors.activity < 35) {
    return "Niska aktywność społeczności osłabia opłacalność zakupu w tej chwili.";
  }

  return "Obecna cena jest zbyt daleko od historycznego minimum lub promocja jest słaba.";
}

export function calculateGameValueScore(input: ScoreInput): GameValueResult {
  const factors: ScoreFactors = {
    pricePosition: round(calculatePricePosition(input.latestPrice)),
    discountQuality: round(clamp(input.latestPrice?.discountPercent ?? 0)),
    activity: round(calculateActivity(input.latestPlayers)),
    trend: round(calculateTrend(input.playerHistory)),
    offerAvailability: round(calculateOfferAvailability(input.offers))
  };

  // Weighting is deliberately transparent for thesis discussion:
  // 35% price against historical low, 20% discount, 20% current activity,
  // 15% player trend, 10% available trusted offers.
  const weightedScore =
    factors.pricePosition * 0.35 +
    factors.discountQuality * 0.2 +
    factors.activity * 0.2 +
    factors.trend * 0.15 +
    factors.offerAvailability * 0.1;

  const score = Math.round(clamp(weightedScore));
  const recommendation = recommendationFor(score, input.latestPrice);

  return {
    score,
    recommendation,
    factors,
    reason: reasonFor(recommendation, factors)
  };
}

export function recommendationLabel(recommendation: Recommendation): string {
  const labels: Record<Recommendation, string> = {
    buy_now: "Kup teraz",
    wait: "Warto poczekać",
    weak_deal: "Słaba okazja"
  };

  return labels[recommendation];
}
