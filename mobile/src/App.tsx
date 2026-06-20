import { Radar } from "lucide-react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { apiClient } from "@/api/client";
import { AboutView } from "@/views/AboutView";
import { DealsView } from "@/views/DealsView";
import { DiagnosticsView } from "@/views/DiagnosticsView";
import { GameDetailsView } from "@/views/GameDetailsView";
import { HomeView } from "@/views/HomeView";
import { SearchView } from "@/views/SearchView";
import { StatsView } from "@/views/StatsView";
import { TopGamesView } from "@/views/TopGamesView";
import { WatchlistView } from "@/views/WatchlistView";
import type { RouteName, RouteState } from "@/routes";

export function App(): React.ReactElement {
  const [route, setRoute] = useState<RouteState>({ name: "home" });
  const activeRoute = useMemo<RouteName>(() => (route.name === "game" ? route.from ?? "home" : route.name), [route]);

  function navigate(name: RouteName): void {
    setRoute({ name: name as Exclude<RouteName, "game"> });
  }

  function openGame(gameId: string, from: RouteName = activeRoute): void {
    setRoute({ name: "game", gameId, from });
  }

  return (
    <div className="safe-bottom min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-radar-bg/92 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-radar-cyan/35 bg-radar-cyan/10 text-radar-cyan">
            <Radar size={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">GameValue Radar</p>
            <p className="truncate text-xs text-slate-400">{apiClient.baseUrl}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {route.name === "home" ? <HomeView onOpenGame={(gameId) => openGame(gameId, "home")} /> : null}
        {route.name === "top" ? <TopGamesView onOpenGame={(gameId) => openGame(gameId, "top")} /> : null}
        {route.name === "search" ? <SearchView onOpenGame={(gameId) => openGame(gameId, "search")} /> : null}
        {route.name === "stats" ? <StatsView onOpenGame={(gameId) => openGame(gameId, "stats")} /> : null}
        {route.name === "deals" ? <DealsView onOpenGame={(gameId) => openGame(gameId, "deals")} /> : null}
        {route.name === "watchlist" ? <WatchlistView onOpenGame={(gameId) => openGame(gameId, "watchlist")} /> : null}
        {route.name === "diagnostics" ? <DiagnosticsView /> : null}
        {route.name === "about" ? <AboutView /> : null}
        {route.name === "game" ? (
          <GameDetailsView gameId={route.gameId} onBack={() => navigate(route.from ?? "home")} />
        ) : null}
      </main>

      <BottomNav active={activeRoute} onNavigate={navigate} />
    </div>
  );
}
