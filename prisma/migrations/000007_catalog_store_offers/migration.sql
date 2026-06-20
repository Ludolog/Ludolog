-- Non-destructive catalog-level price storage.
-- This keeps large Steam/GOG catalog price coverage separate from imported Game rows.

CREATE TABLE "CatalogStoreOffer" (
    "id" TEXT NOT NULL,
    "steamAppId" INTEGER,
    "gogProductId" TEXT,
    "catalogSource" TEXT NOT NULL,
    "gameId" TEXT,
    "provider" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeType" TEXT NOT NULL DEFAULT 'unknown',
    "title" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "regularPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "externalUrl" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'PL',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "drm" TEXT NOT NULL,
    "sourceRawId" TEXT,
    "rawProviderData" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogStoreOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogStoreOffer_steamAppId_idx" ON "CatalogStoreOffer"("steamAppId");
CREATE INDEX "CatalogStoreOffer_gogProductId_idx" ON "CatalogStoreOffer"("gogProductId");
CREATE INDEX "CatalogStoreOffer_catalogSource_idx" ON "CatalogStoreOffer"("catalogSource");
CREATE INDEX "CatalogStoreOffer_provider_idx" ON "CatalogStoreOffer"("provider");
CREATE INDEX "CatalogStoreOffer_storeName_idx" ON "CatalogStoreOffer"("storeName");
CREATE INDEX "CatalogStoreOffer_fetchedAt_idx" ON "CatalogStoreOffer"("fetchedAt");
