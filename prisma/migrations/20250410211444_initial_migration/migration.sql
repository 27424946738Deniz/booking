/*
  Warnings:

  - You are about to drop the column `currency` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `minPrice` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `scrapeDate` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `totalAvailableRooms` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `hotelId` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `lastScrapeDate` on the `Room` table. All the data in the column will be lost.
  - Added the required column `availabilityId` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_hotelId_fkey";

-- DropIndex
DROP INDEX "Hotel_scrapeDate_idx";

-- DropIndex
DROP INDEX "Room_hotelId_idx";

-- DropIndex
DROP INDEX "Room_hotelId_roomName_key";

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "currency",
DROP COLUMN "minPrice",
DROP COLUMN "scrapeDate",
DROP COLUMN "totalAvailableRooms";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "hotelId",
DROP COLUMN "lastScrapeDate",
ADD COLUMN     "availabilityId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Availability" (
    "id" SERIAL NOT NULL,
    "hotelId" INTEGER NOT NULL,
    "scrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minPrice" DOUBLE PRECISION,
    "totalAvailableRooms" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT DEFAULT 'TRY',

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_hotelId_idx" ON "Availability"("hotelId");

-- CreateIndex
CREATE INDEX "Availability_scrapeDate_idx" ON "Availability"("scrapeDate");

-- CreateIndex
CREATE INDEX "Room_availabilityId_idx" ON "Room"("availabilityId");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
