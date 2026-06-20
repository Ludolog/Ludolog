CREATE TABLE "TopTrackedGame" (
    "id" TEXT NOT NULL,
    "steamAppId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'curated-top-100',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopTrackedGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopTrackedGame_steamAppId_key" ON "TopTrackedGame"("steamAppId");
CREATE INDEX "TopTrackedGame_priority_idx" ON "TopTrackedGame"("priority");
CREATE INDEX "TopTrackedGame_isActive_priority_idx" ON "TopTrackedGame"("isActive", "priority");
CREATE INDEX "TopTrackedGame_gameId_idx" ON "TopTrackedGame"("gameId");

ALTER TABLE "TopTrackedGame"
ADD CONSTRAINT "TopTrackedGame_gameId_fkey"
FOREIGN KEY ("gameId") REFERENCES "Game"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
