ALTER TYPE "DataSource" ADD VALUE IF NOT EXISTS 'gog';
ALTER TYPE "IntegrationService" ADD VALUE IF NOT EXISTS 'gog';

CREATE TABLE IF NOT EXISTS "GogCatalogEntry" (
  "id" TEXT NOT NULL,
  "gogProductId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "url" TEXT,
  "imageUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "productType" TEXT,
  "rawData" JSONB,
  "syncedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GogCatalogEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GogCatalogEntry_gogProductId_key" ON "GogCatalogEntry"("gogProductId");
CREATE INDEX IF NOT EXISTS "GogCatalogEntry_title_idx" ON "GogCatalogEntry"("title");
CREATE INDEX IF NOT EXISTS "GogCatalogEntry_slug_idx" ON "GogCatalogEntry"("slug");
CREATE INDEX IF NOT EXISTS "GogCatalogEntry_isActive_idx" ON "GogCatalogEntry"("isActive");
CREATE INDEX IF NOT EXISTS "GogCatalogEntry_syncedAt_idx" ON "GogCatalogEntry"("syncedAt");

CREATE TABLE IF NOT EXISTS "GameExternalMapping" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalSlug" TEXT,
  "confidence" TEXT NOT NULL DEFAULT 'unknown',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameExternalMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameExternalMapping_gameId_provider_key" ON "GameExternalMapping"("gameId", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "GameExternalMapping_provider_externalId_key" ON "GameExternalMapping"("provider", "externalId");
CREATE INDEX IF NOT EXISTS "GameExternalMapping_provider_idx" ON "GameExternalMapping"("provider");
CREATE INDEX IF NOT EXISTS "GameExternalMapping_provider_externalSlug_idx" ON "GameExternalMapping"("provider", "externalSlug");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GameExternalMapping_gameId_fkey'
  ) THEN
    ALTER TABLE "GameExternalMapping"
    ADD CONSTRAINT "GameExternalMapping_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
