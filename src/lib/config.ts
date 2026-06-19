import type { DataMode } from "@/lib/types";

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

export function getCronSecret(): string | undefined {
  return getOptionalEnv("CRON_SECRET");
}
