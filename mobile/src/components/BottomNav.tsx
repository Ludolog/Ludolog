import { BadgePercent, Home, Info, Search, Server, Star } from "lucide-react";

import type { RouteName } from "@/routes";

const items: Array<{ route: RouteName; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { route: "home", label: "Home", icon: Home },
  { route: "search", label: "Search", icon: Search },
  { route: "deals", label: "Deals", icon: BadgePercent },
  { route: "watchlist", label: "Watch", icon: Star },
  { route: "diagnostics", label: "Status", icon: Server },
  { route: "about", label: "About", icon: Info }
];

export function BottomNav({
  active,
  onNavigate
}: {
  active: RouteName;
  onNavigate: (route: RouteName) => void;
}): React.ReactElement {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-radar-bg/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
      <div className="grid grid-cols-6 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium ${
                isActive ? "bg-radar-cyan/15 text-radar-cyan" : "text-slate-400"
              }`}
            >
              <Icon size={18} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
