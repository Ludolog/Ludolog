export type RouteName = "home" | "search" | "deals" | "watchlist" | "diagnostics" | "about" | "game";

export type RouteState =
  | { name: Exclude<RouteName, "game"> }
  | { name: "game"; gameId: string; from?: RouteName };
