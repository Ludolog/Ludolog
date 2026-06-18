-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('mock', 'steam_api', 'price_api', 'prisma');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('buy_now', 'wait', 'weak_deal');

-- CreateEnum
CREATE TYPE "IntegrationLevel" AS ENUM ('info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "IntegrationService" AS ENUM ('steam', 'price', 'search', 'snapshot', 'alerts');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "steamAppId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "genres" TEXT[],
    "developer" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "reviewScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOffer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL,
    "drm" TEXT NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'mock',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePriceSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "historicalLow" DECIMAL(10,2) NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "storeName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'mock',

    CONSTRAINT "GamePriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCountSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "steamAppId" INTEGER NOT NULL,
    "playersOnline" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'mock',

    CONSTRAINT "PlayerCountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealScoreSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "recommendation" "Recommendation" NOT NULL,
    "factors" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2),
    "alertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "thresholdPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "service" "IntegrationService" NOT NULL,
    "level" "IntegrationLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "StoreOffer_gameId_idx" ON "StoreOffer"("gameId");

-- CreateIndex
CREATE INDEX "GamePriceSnapshot_gameId_capturedAt_idx" ON "GamePriceSnapshot"("gameId", "capturedAt");

-- CreateIndex
CREATE INDEX "PlayerCountSnapshot_gameId_capturedAt_idx" ON "PlayerCountSnapshot"("gameId", "capturedAt");

-- CreateIndex
CREATE INDEX "PlayerCountSnapshot_steamAppId_idx" ON "PlayerCountSnapshot"("steamAppId");

-- CreateIndex
CREATE INDEX "DealScoreSnapshot_gameId_capturedAt_idx" ON "DealScoreSnapshot"("gameId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Watchlist_gameId_idx" ON "Watchlist"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_gameId_key" ON "Watchlist"("userId", "gameId");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_gameId_idx" ON "PriceAlert"("gameId");

-- AddForeignKey
ALTER TABLE "StoreOffer" ADD CONSTRAINT "StoreOffer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePriceSnapshot" ADD CONSTRAINT "GamePriceSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCountSnapshot" ADD CONSTRAINT "PlayerCountSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealScoreSnapshot" ADD CONSTRAINT "DealScoreSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

