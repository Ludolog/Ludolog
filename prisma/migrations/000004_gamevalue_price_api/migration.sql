CREATE TABLE IF NOT EXISTS "PriceSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "storeType" TEXT NOT NULL DEFAULT 'unknown',
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PriceSource_name_key" ON "PriceSource"("name");
CREATE INDEX IF NOT EXISTS "PriceSource_type_idx" ON "PriceSource"("type");
CREATE INDEX IF NOT EXISTS "PriceSource_isActive_idx" ON "PriceSource"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "Store_slug_key" ON "Store"("slug");
CREATE INDEX IF NOT EXISTS "Store_storeType_idx" ON "Store"("storeType");
CREATE INDEX IF NOT EXISTS "Store_isActive_idx" ON "Store"("isActive");

ALTER TABLE "StoreOffer"
ADD COLUMN IF NOT EXISTS "steamAppId" INTEGER,
ADD COLUMN IF NOT EXISTS "storeId" TEXT,
ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'PL',
ADD COLUMN IF NOT EXISTS "isOfficialStore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'PC',
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "GamePriceSnapshot"
ADD COLUMN IF NOT EXISTS "steamAppId" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
ADD COLUMN IF NOT EXISTS "offerCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "StoreOffer_steamAppId_idx" ON "StoreOffer"("steamAppId");
CREATE INDEX IF NOT EXISTS "StoreOffer_storeId_idx" ON "StoreOffer"("storeId");
CREATE INDEX IF NOT EXISTS "StoreOffer_sourceId_idx" ON "StoreOffer"("sourceId");
CREATE INDEX IF NOT EXISTS "GamePriceSnapshot_steamAppId_idx" ON "GamePriceSnapshot"("steamAppId");
CREATE INDEX IF NOT EXISTS "GamePriceSnapshot_sourceId_idx" ON "GamePriceSnapshot"("sourceId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoreOffer_storeId_fkey'
    ) THEN
        ALTER TABLE "StoreOffer"
        ADD CONSTRAINT "StoreOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoreOffer_sourceId_fkey'
    ) THEN
        ALTER TABLE "StoreOffer"
        ADD CONSTRAINT "StoreOffer_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GamePriceSnapshot_sourceId_fkey'
    ) THEN
        ALTER TABLE "GamePriceSnapshot"
        ADD CONSTRAINT "GamePriceSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
