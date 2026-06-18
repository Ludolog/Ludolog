import Link from "next/link";
import { BarChart3, Database, Radar, Search, Star, Wrench } from "lucide-react";

import { getDataMode } from "@/lib/config";

const navItems = [
  { href: "/", label: "Radar", icon: Radar },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/admin", label: "Admin", icon: Wrench },
  { href: "/about", label: "Engineering", icon: BarChart3 }
];

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const mode = getDataMode();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-radar-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
              <Radar size={19} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">GameValue Radar</span>
              <span className="block truncate text-xs text-slate-400">PC purchase intelligence</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  <Icon size={16} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 rounded-md border border-radar-green/30 bg-radar-green/10 px-3 py-2 text-xs font-medium text-radar-green">
            <Database size={14} aria-hidden />
            {mode.toUpperCase()}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">
        GameValue Radar jest edukacyjnym projektem inĹĽynierskim i nie jest oficjalnie powiÄ…zany ze Steam, Valve,
        GG.deals ani SteamDB.
      </footer>
    </div>
  );
}

