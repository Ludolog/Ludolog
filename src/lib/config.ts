import type { DataMode, PriceMode, PriceProviderName } from "@/lib/types";

export const DEMO_USER_ID = "demo-user";

export function getDataMode(): DataMode {
  return process.env.DATA_MODE === "api" ? "api" : "mock";
}

export function isApiMode(): boolean {
  return getDataMode() === "api";
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export function getSteamWebApiKey(): string | undefined {
  return getOptionalEnv("STEAM_WEB_API_KEY") ?? getOptionalEnv("STEAM_API_KEY");
}

export function getPriceMode(): PriceMode {
  const mode = getOptionalEnv("PRICE_MODE")?.toLowerCase();
  if (mode === "mock") {
    return "mock";
  }
  if (mode === "api" && areLegacyPriceProvidersEnabled()) {
    return "api";
  }
  return "internal";
}

export function getPriceProvider(): PriceProviderName {
  const provider = (getOptionalEnv("PRICE_PROVIDER") ?? getOptionalEnv("PRICE_API_PROVIDER") ?? "gamevalue").toLowerCase();

  if (provider === "gamevalue") {
    return "gamevalue";
  }

  if (provider === "mock") {
    return "mock";
  }

  if (areLegacyPriceProvidersEnabled() && (provider === "ggdeals" || provider === "itad" || provider === "cheapshark")) {
    return provider;
  }

  return "gamevalue";
}

export function areLegacyPriceProvidersEnabled(): boolean {
  return getOptionalEnv("ENABLE_LEGACY_PRICE_PROVIDERS") === "true";
}

export function getGGDealsApiKey(): string | undefined {
  return getOptionalEnv("GGDEALS_API_KEY") ?? getOptionalEnv("GG_DEALS_API_KEY");
}

export function getGGDealsApiBaseUrl(): string {
  return getOptionalEnv("GGDEALS_API_BASE_URL") ?? "https://gg.deals/api/prices/by-steam-app-id/";
}

export function getGGDealsRegion(): string {
  return getOptionalEnv("GGDEALS_REGION") ?? "pl";
}

export function getGGDealsCurrency(): string {
  return getOptionalEnv("GGDEALS_CURRENCY") ?? "PLN";
}

export function isGogEnabled(): boolean {
  return getOptionalEnv("GOG_ENABLED") === "true";
}

export function getGogApiBaseUrl(): string {
  return trimTrailingSlash(getOptionalEnv("GOG_API_BASE_URL") ?? "https://api.gog.com");
}

export function getGogCatalogBaseUrl(): string {
  return trimTrailingSlash(getOptionalEnv("GOG_CATALOG_BASE_URL") ?? "https://catalog.gog.com");
}

export function getGogCountryCode(): string {
  return (getOptionalEnv("GOG_COUNTRY_CODE") ?? "PL").toUpperCase();
}

export function getGogCurrency(): string {
  return (getOptionalEnv("GOG_CURRENCY") ?? "PLN").toUpperCase();
}

export function getGogRequestLimitPerHour(): number {
  const raw = Number(getOptionalEnv("GOG_REQUEST_LIMIT_PER_HOUR") ?? "200");
  if (!Number.isFinite(raw) || raw <= 0) {
    return 200;
  }
  return Math.min(Math.floor(raw), 200);
}

export function getAdminApiSecret(): string | undefined {
  return getOptionalEnv("ADMIN_API_SECRET");
}

export function getCronSecret(): string | undefined {
  return getOptionalEnv("CRON_SECRET");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}
