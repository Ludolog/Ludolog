-- Add source tracking to imported/demo games.
ALTER TABLE "Game" ADD COLUMN "source" "DataSource" NOT NULL DEFAULT 'mock';

-- Store a controlled subset of the Steam app catalog. Sync is manual/admin-triggered.
CREATE TABLE "SteamCatalogEntry" (
    "id" TEXT NOT NULL,
    "steamAppId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "lastModified" INTEGER,
    "priceChangeNumber" INTEGER,
    "isGame" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "DataSource" NOT NULL DEFAULT 'steam_api',
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamCatalogEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SteamCatalogEntry_steamAppId_key" ON "SteamCatalogEntry"("steamAppId");
CREATE INDEX "SteamCatalogEntry_title_idx" ON "SteamCatalogEntry"("title");
CREATE INDEX "SteamCatalogEntry_isGame_isActive_idx" ON "SteamCatalogEntry"("isGame", "isActive");
CREATE INDEX "SteamCatalogEntry_syncedAt_idx" ON "SteamCatalogEntry"("syncedAt");
