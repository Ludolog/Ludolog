import type { DataSource, PriceSourceConfidence, StoreOffer } from "@/lib/types";
import { showGogPublic } from "@/lib/config";

const realOfferSourceRank: Partial<Record<DataSource, number>> = {
  gog: 0,
  "steam-store": 1,
  manual: 2,
  prisma: 3,
  ggdeals: 4,
  "price-api": 5
};

export function isMockPriceSource(source: DataSource | null | undefined): boolean {
  return source === "mock";
}

export function isTrustedPriceSource(source: DataSource | null | undefined): boolean {
  if (source === "gog" && !showGogPublic()) {
    return false;
  }
  return source !== undefined && source !== null && source !== "mock";
}

export function trustedOffersOnly(offers: StoreOffer[]): StoreOffer[] {
  return offers.filter((offer) => offer.available && isTrustedPriceSource(offer.source));
}

export function compareTrustedOffers(a: StoreOffer, b: StoreOffer): number {
  const sourceDiff = sourceRank(a.source) - sourceRank(b.source);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }
  const priceDiff = a.price - b.price;
  if (priceDiff !== 0) {
    return priceDiff;
  }
  const confidenceDiff = sourceConfidenceRank(a.sourceConfidence) - sourceConfidenceRank(b.sourceConfidence);
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

export function sourceConfidenceForDataSource(source: DataSource): PriceSourceConfidence {
  if (source === "mock") {
    return "internal-mock";
  }
  if (source === "steam-store") {
    return "experimental-store-api";
  }
  if (source === "manual" || source === "prisma" || source === "gog") {
    return "internal-real";
  }
  if (source === "ggdeals" || source === "price-api") {
    return "external-legacy";
  }
  return "no-price-data";
}

export function sourceRank(source: DataSource): number {
  return realOfferSourceRank[source] ?? 99;
}

export function sourceConfidenceRank(source: PriceSourceConfidence): number {
  if (source === "internal-real") {
    return 0;
  }
  if (source === "experimental-store-api") {
    return 1;
  }
  if (source === "external-legacy") {
    return 2;
  }
  if (source === "internal-mock") {
    return 3;
  }
  return 4;
}
