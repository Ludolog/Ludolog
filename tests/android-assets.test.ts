import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const assetsDir = join(process.cwd(), "mobile", "android", "app", "src", "main", "assets");
const forbidden = [
  "GGDEALS_API_KEY",
  "STEAM_WEB_API_KEY",
  "ADMIN_API_SECRET",
  "CRON_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "10.0.2.2",
  "localhost:3000"
];

describe("Android assets", () => {
  it("do not contain backend secrets or development API hosts", () => {
    if (!existsSync(assetsDir)) {
      return;
    }

    const matches: string[] = [];
    for (const file of walk(assetsDir)) {
      const content = readFileSync(file, "utf8");
      for (const token of forbidden) {
        if (content.includes(token)) {
          matches.push(`${file}: ${token}`);
        }
      }
    }

    expect(matches).toEqual([]);
  });
});

function walk(directory: string): string[] {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);
    return stat.isDirectory() ? walk(path) : [path];
  });
}
