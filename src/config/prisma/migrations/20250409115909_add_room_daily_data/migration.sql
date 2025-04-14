/*
  Warnings:

  - You are about to drop the column `cancelPolicy` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `mealPlan` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `originalPrice` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `roomsLeft` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `scrapeDate` on the `Room` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Room_scrapeDate_idx";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "cancelPolicy",
DROP COLUMN "currency",
DROP COLUMN "mealPlan",
DROP COLUMN "originalPrice",
DROP COLUMN "price",
DROP COLUMN "roomsLeft",
DROP COLUMN "scrapeDate";

-- CreateTable
CREATE TABLE "RoomDailyData" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "roomsLeft" INTEGER NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION,
    "originalPrice" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'TRY',
    "mealPlan" TEXT,
    "cancelPolicy" TEXT,
    "scrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomDailyData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomDailyData_roomId_idx" ON "RoomDailyData"("roomId");

-- CreateIndex
CREATE INDEX "RoomDailyData_date_idx" ON "RoomDailyData"("date");

-- CreateIndex
CREATE INDEX "RoomDailyData_scrapeDate_idx" ON "RoomDailyData"("scrapeDate");

-- CreateIndex
CREATE UNIQUE INDEX "RoomDailyData_roomId_date_key" ON "RoomDailyData"("roomId", "date");

-- AddForeignKey
ALTER TABLE "RoomDailyData" ADD CONSTRAINT "RoomDailyData_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
