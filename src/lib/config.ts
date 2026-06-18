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
