CREATE TABLE "CatalogPriceCheckStatus" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "steamAppId" INTEGER,
    "gogProductId" TEXT,
    "status" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "nextCheckAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogPriceCheckStatus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogPriceCheckStatus_sourceName_status_nextCheckAt_idx" ON "CatalogPriceCheckStatus"("sourceName", "status", "nextCheckAt");
CREATE INDEX "CatalogPriceCheckStatus_steamAppId_idx" ON "CatalogPriceCheckStatus"("steamAppId");
CREATE INDEX "CatalogPriceCheckStatus_gogProductId_idx" ON "CatalogPriceCheckStatus"("gogProductId");
