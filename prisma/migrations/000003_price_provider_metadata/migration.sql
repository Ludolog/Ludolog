ALTER TYPE "DataSource" ADD VALUE IF NOT EXISTS 'ggdeals';
ALTER TYPE "DataSource" ADD VALUE IF NOT EXISTS 'manual';

ALTER TYPE "IntegrationService" ADD VALUE IF NOT EXISTS 'ggdeals';

ALTER TABLE "StoreOffer"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN "storeType" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "regularPrice" DECIMAL(10, 2),
  ADD COLUMN "historicalLow" DECIMAL(10, 2),
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "isHistoricalLow" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceRawId" TEXT,
  ADD COLUMN "rawProviderData" JSONB,
  ADD COLUMN "fetchedAt" TIMESTAMP(3);

ALTER TABLE "GamePriceSnapshot"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN "storeType" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "isHistoricalLow" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceRawId" TEXT,
  ADD COLUMN "rawProviderData" JSONB,
  ADD COLUMN "fetchedAt" TIMESTAMP(3);

CREATE INDEX "StoreOffer_provider_idx" ON "StoreOffer"("provider");
CREATE INDEX "StoreOffer_source_idx" ON "StoreOffer"("source");
CREATE INDEX "GamePriceSnapshot_provider_idx" ON "GamePriceSnapshot"("provider");
CREATE INDEX "GamePriceSnapshot_source_idx" ON "GamePriceSnapshot"("source");
