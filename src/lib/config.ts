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
  return process.env.PRICE_MODE === "api" ? "api" : "mock";
}

export function getPriceProvider(): PriceProviderName {
  const provider = (getOptionalEnv("PRICE_PROVIDER") ?? getOptionalEnv("PRICE_API_PROVIDER") ?? "mock").toLowerCase();

  if (provider === "ggdeals" || provider === "itad" || provider === "cheapshark") {
    return provider;
  }

  return "mock";
}

export function getGGDealsApiKey(): string | undefined {
  return getOptionalEnv("GGDEALS_API_KEY") ?? getOptionalEnv("GG_DEALS_API_KEY");
}

export function getGGDealsApiBaseUrl(): string {
  return getOptionalEnv("GGDEALS_API_BASE_URL") ?? "https://gg.deals/api/prices/by-steam-app-id/";
}

export function getAdminApiSecret(): string | undefined {
  return getOptionalEnv("ADMIN_API_SECRET");
}

export function getCronSecret(): string | undefined {
  return getOptionalEnv("CRON_SECRET");
}
