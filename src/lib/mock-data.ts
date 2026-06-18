import { DEMO_USER_ID } from "@/lib/config";
import type {
  Game,
  GamePriceSnapshot,
  PlayerCountSnapshot,
  PriceAlert,
  StoreOffer,
  User,
  WatchlistItem
} from "@/lib/types";

const baseDate = new Date("2026-06-18T12:00:00.000Z");
const dayMs = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(baseDate.getTime() - days * dayMs);
}

type GameFixture = Omit<Game, "createdAt" | "updatedAt"> & {
  basePrice: number;
  currentPrice: number;
  historicalLow: number;
  currentPlayers: number;
  trendFactor: number;
  stores: Array<{
    storeName: string;
    price: number;
    discountPercent: number;
    drm: string;
    isOfficial?: boolean;
  }>;
};

const fixtures: GameFixture[] = [
  {
    id: "counter-strike-2",
    steamAppId: 730,
    title: "Counter-Strike 2",
    slug: "counter-strike-2",
    platform: "Steam",
    description:
      "Competitive tactical shooter with a large esports ecosystem and a free-to-play model.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg",
    genres: ["FPS", "Competitive", "Esports"],
    developer: "Valve",
    publisher: "Valve",
    releaseDate: "2023-09-27",
    reviewScore: 78,
    basePrice: 0,
    currentPrice: 0,
    historicalLow: 0,
    currentPlayers: 782000,
    trendFactor: 1.04,
    stores: [{ storeName: "Steam", price: 0, discountPercent: 0, drm: "Steam", isOfficial: true }]
  },
  {
    id: "cyberpunk-2077",
    steamAppId: 1091500,
    title: "Cyberpunk 2077",
    slug: "cyberpunk-2077",
    platform: "PC",
    description:
      "Open-world RPG set in Night City with branching quests, cyberware builds and cinematic storytelling.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg",
    genres: ["RPG", "Open World", "Sci-fi"],
    developer: "CD PROJEKT RED",
    publisher: "CD PROJEKT RED",
    releaseDate: "2020-12-10",
    reviewScore: 83,
    basePrice: 199.99,
    currentPrice: 119.99,
    historicalLow: 79.99,
    currentPlayers: 48200,
    trendFactor: 1.11,
    stores: [
      { storeName: "Steam", price: 119.99, discountPercent: 40, drm: "Steam", isOfficial: true },
      { storeName: "GOG.com", price: 114.99, discountPercent: 43, drm: "DRM-free", isOfficial: true },
      { storeName: "Humble Store", price: 122.49, discountPercent: 39, drm: "Steam" }
    ]
  },
  {
    id: "the-witcher-3",
    steamAppId: 292030,
    title: "The Witcher 3: Wild Hunt",
    slug: "the-witcher-3",
    platform: "PC",
    description:
      "Story-driven fantasy RPG with a large open world, expansions and long-tail player interest.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg",
    genres: ["RPG", "Open World", "Fantasy"],
    developer: "CD PROJEKT RED",
    publisher: "CD PROJEKT RED",
    releaseDate: "2015-05-18",
    reviewScore: 96,
    basePrice: 149.99,
    currentPrice: 29.99,
    historicalLow: 19.99,
    currentPlayers: 21400,
    trendFactor: 0.96,
    stores: [
      { storeName: "Steam", price: 29.99, discountPercent: 80, drm: "Steam", isOfficial: true },
      { storeName: "GOG.com", price: 27.99, discountPercent: 81, drm: "DRM-free", isOfficial: true },
      { storeName: "Epic Games Store", price: 34.99, discountPercent: 77, drm: "Epic" }
    ]
  },
  {
    id: "baldurs-gate-3",
    steamAppId: 1086940,
    title: "Baldur's Gate 3",
    slug: "baldurs-gate-3",
    platform: "PC",
    description:
      "Party-based RPG built around choice, tactical combat and cooperative campaign play.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg",
    genres: ["RPG", "Turn-Based", "Co-op"],
    developer: "Larian Studios",
    publisher: "Larian Studios",
    releaseDate: "2023-08-03",
    reviewScore: 96,
    basePrice: 249.99,
    currentPrice: 199.99,
    historicalLow: 159.99,
    currentPlayers: 86100,
    trendFactor: 1.02,
    stores: [
      { storeName: "Steam", price: 199.99, discountPercent: 20, drm: "Steam", isOfficial: true },
      { storeName: "GOG.com", price: 199.99, discountPercent: 20, drm: "DRM-free", isOfficial: true }
    ]
  },
  {
    id: "elden-ring",
    steamAppId: 1245620,
    title: "Elden Ring",
    slug: "elden-ring",
    platform: "PC",
    description:
      "Action RPG focused on exploration, boss encounters and build experimentation in a dark fantasy world.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg",
    genres: ["Action RPG", "Soulslike", "Open World"],
    developer: "FromSoftware",
    publisher: "Bandai Namco Entertainment",
    releaseDate: "2022-02-25",
    reviewScore: 92,
    basePrice: 249.99,
    currentPrice: 169.99,
    historicalLow: 129.99,
    currentPlayers: 55800,
    trendFactor: 1.07,
    stores: [
      { storeName: "Steam", price: 169.99, discountPercent: 32, drm: "Steam", isOfficial: true },
      { storeName: "Green Man Gaming", price: 164.99, discountPercent: 34, drm: "Steam" }
    ]
  },
  {
    id: "stardew-valley",
    steamAppId: 413150,
    title: "Stardew Valley",
    slug: "stardew-valley",
    platform: "PC",
    description:
      "Farming and life simulation game with cooperative play, crafting and strong replay value.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg",
    genres: ["Simulation", "Farming", "Cozy"],
    developer: "ConcernedApe",
    publisher: "ConcernedApe",
    releaseDate: "2016-02-26",
    reviewScore: 98,
    basePrice: 53.99,
    currentPrice: 23.99,
    historicalLow: 17.99,
    currentPlayers: 38900,
    trendFactor: 1.18,
    stores: [
      { storeName: "Steam", price: 23.99, discountPercent: 56, drm: "Steam", isOfficial: true },
      { storeName: "Humble Store", price: 21.99, discountPercent: 59, drm: "Steam" },
      { storeName: "GOG.com", price: 24.99, discountPercent: 54, drm: "DRM-free", isOfficial: true }
    ]
  },
  {
    id: "terraria",
    steamAppId: 105600,
    title: "Terraria",
    slug: "terraria",
    platform: "PC",
    description:
      "2D sandbox adventure with crafting, exploration, boss progression and long-term content updates.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg",
    genres: ["Sandbox", "Adventure", "Survival"],
    developer: "Re-Logic",
    publisher: "Re-Logic",
    releaseDate: "2011-05-16",
    reviewScore: 97,
    basePrice: 39.99,
    currentPrice: 19.99,
    historicalLow: 9.99,
    currentPlayers: 52300,
    trendFactor: 1.03,
    stores: [
      { storeName: "Steam", price: 19.99, discountPercent: 50, drm: "Steam", isOfficial: true },
      { storeName: "GOG.com", price: 19.99, discountPercent: 50, drm: "DRM-free", isOfficial: true }
    ]
  },
  {
    id: "euro-truck-simulator-2",
    steamAppId: 227300,
    title: "Euro Truck Simulator 2",
    slug: "euro-truck-simulator-2",
    platform: "PC",
    description:
      "Driving simulation game with a stable community, economy loops and extensive map expansions.",
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/227300/header.jpg",
    genres: ["Simulation", "Driving", "Management"],
    developer: "SCS Software",
    publisher: "SCS Software",
    releaseDate: "2012-10-18",
    reviewScore: 95,
    basePrice: 89.99,
    currentPrice: 17.99,
    historicalLow: 9.99,
    currentPlayers: 42100,
    trendFactor: 0.98,
    stores: [
      { storeName: "Steam", price: 17.99, discountPercent: 80, drm: "Steam", isOfficial: true },
      { storeName: "Humble Store", price: 19.99, discountPercent: 78, drm: "Steam" }
    ]
  }
];

function priceForDay(fixture: GameFixture, dayOffset: number): number {
  if (fixture.currentPrice === 0) {
    return 0;
  }

  const wave = Math.sin(dayOffset * 0.9) * 0.035;
  const olderPremium = dayOffset * 0.014;
  const price = fixture.currentPrice * (1 + olderPremium + wave);
  return Math.max(fixture.historicalLow, Number(price.toFixed(2)));
}

function playersForDay(fixture: GameFixture, dayOffset: number): number {
  const trendDelta = fixture.trendFactor - 1;
  const historicalFactor = 1 - trendDelta * (dayOffset / 13);
  const wave = Math.sin(dayOffset * 0.7 + fixture.steamAppId) * 0.055;
  return Math.max(0, Math.round(fixture.currentPlayers * (historicalFactor + wave)));
}

export const mockGames: Game[] = fixtures.map((fixture) => ({
  ...fixture,
  createdAt: daysAgo(30),
  updatedAt: baseDate
}));

export const mockStoreOffers: StoreOffer[] = fixtures.flatMap((fixture) =>
  fixture.stores.map((offer, index) => ({
    id: `offer-${fixture.id}-${index + 1}`,
    gameId: fixture.id,
    storeName: offer.storeName,
    price: offer.price,
    currency: "PLN",
    discountPercent: offer.discountPercent,
    url:
      offer.storeName === "Steam"
        ? `https://store.steampowered.com/app/${fixture.steamAppId}`
        : "https://example.com/gamevalue-demo-offer",
    isOfficial: offer.isOfficial ?? false,
    drm: offer.drm,
    updatedAt: baseDate,
    source: "mock"
  }))
);

export const mockPriceSnapshots: GamePriceSnapshot[] = fixtures.flatMap((fixture) =>
  Array.from({ length: 14 }, (_, index) => {
    const dayOffset = 13 - index;
    const price = index === 13 ? fixture.currentPrice : priceForDay(fixture, dayOffset);
    return {
      id: `price-${fixture.id}-${index + 1}`,
      gameId: fixture.id,
      price,
      historicalLow: fixture.historicalLow,
      basePrice: fixture.basePrice,
      discountPercent:
        fixture.basePrice === 0 ? 0 : Math.max(0, Math.round((1 - price / fixture.basePrice) * 100)),
      storeName: fixture.stores[0]?.storeName ?? "Mock Store",
      currency: "PLN",
      capturedAt: daysAgo(dayOffset),
      source: "mock"
    };
  })
);

export const mockPlayerSnapshots: PlayerCountSnapshot[] = fixtures.flatMap((fixture) =>
  Array.from({ length: 14 }, (_, index) => {
    const dayOffset = 13 - index;
    const playersOnline = index === 13 ? fixture.currentPlayers : playersForDay(fixture, dayOffset);
    return {
      id: `players-${fixture.id}-${index + 1}`,
      gameId: fixture.id,
      steamAppId: fixture.steamAppId,
      playersOnline,
      capturedAt: daysAgo(dayOffset),
      source: "mock"
    };
  })
);

export const mockUsers: User[] = [
  {
    id: DEMO_USER_ID,
    email: "demo@gamevalueradar.local",
    name: "Demo user",
    createdAt: daysAgo(20)
  }
];

export const mockWatchlistItems: WatchlistItem[] = [
  {
    id: "watch-cyberpunk-2077",
    userId: DEMO_USER_ID,
    gameId: "cyberpunk-2077",
    targetPrice: 89.99,
    alertEnabled: true,
    createdAt: daysAgo(4)
  },
  {
    id: "watch-baldurs-gate-3",
    userId: DEMO_USER_ID,
    gameId: "baldurs-gate-3",
    targetPrice: 169.99,
    alertEnabled: true,
    createdAt: daysAgo(3)
  },
  {
    id: "watch-stardew-valley",
    userId: DEMO_USER_ID,
    gameId: "stardew-valley",
    targetPrice: 19.99,
    alertEnabled: false,
    createdAt: daysAgo(1)
  }
];

export const mockPriceAlerts: PriceAlert[] = [
  {
    id: "alert-cyberpunk-2077",
    userId: DEMO_USER_ID,
    gameId: "cyberpunk-2077",
    thresholdPrice: 89.99,
    isActive: true,
    triggeredAt: null,
    createdAt: daysAgo(4)
  },
  {
    id: "alert-baldurs-gate-3",
    userId: DEMO_USER_ID,
    gameId: "baldurs-gate-3",
    thresholdPrice: 169.99,
    isActive: true,
    triggeredAt: null,
    createdAt: daysAgo(3)
  }
];
