import type { Recommendation } from "@shared/api-types";

export function formatPrice(value: number | null | undefined, currency = "PLN"): string {
  if (value === null || value === undefined) {
    return "Brak danych";
  }

  if (value === 0) {
    return "Darmowa";
  }

  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Brak danych";
  }

  return new Intl.NumberFormat("pl-PL").format(value);
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

export function recommendationLabel(recommendation: Recommendation): string {
  const labels: Record<Recommendation, string> = {
    buy_now: "Kup teraz",
    wait: "Poczekaj",
    weak_deal: "Słaba okazja"
  };

  return labels[recommendation];
}

export function recommendationClass(recommendation: Recommendation): string {
  const classes: Record<Recommendation, string> = {
    buy_now: "border-radar-green/40 bg-radar-green/15 text-radar-green",
    wait: "border-radar-amber/40 bg-radar-amber/15 text-radar-amber",
    weak_deal: "border-radar-red/40 bg-radar-red/15 text-radar-red"
  };

  return classes[recommendation];
}
