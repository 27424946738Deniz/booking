/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `minRoomPrice` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `available` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Room` table. All the data in the column will be lost.
  - Added the required column `roomName` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Hotel_district_idx";

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "createdAt",
DROP COLUMN "district",
DROP COLUMN "minRoomPrice",
DROP COLUMN "price",
DROP COLUMN "updatedAt",
ADD COLUMN     "currency" TEXT DEFAULT 'TRY',
ADD COLUMN     "minPrice" DOUBLE PRECISION,
ADD COLUMN     "scrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "available",
DROP COLUMN "createdAt",
DROP COLUMN "name",
DROP COLUMN "updatedAt",
ADD COLUMN     "cancelPolicy" TEXT,
ADD COLUMN     "currency" TEXT DEFAULT 'TRY',
ADD COLUMN     "mealPlan" TEXT,
ADD COLUMN     "originalPrice" DOUBLE PRECISION,
ADD COLUMN     "roomName" TEXT NOT NULL,
ADD COLUMN     "roomsLeft" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Hotel_location_idx" ON "Hotel"("location");

-- CreateIndex
CREATE INDEX "Hotel_scrapeDate_idx" ON "Hotel"("scrapeDate");

-- CreateIndex
CREATE INDEX "Room_scrapeDate_idx" ON "Room"("scrapeDate");
