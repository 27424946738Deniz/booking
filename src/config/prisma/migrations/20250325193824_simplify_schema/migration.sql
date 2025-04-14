/*
  Warnings:

  - You are about to drop the column `address` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `amenities` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `reviewCount` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `scrapeDate` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `roomName` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `roomsLeft` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `scrapeDate` on the `Room` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Hotel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Hotel_scrapeDate_idx";

-- DropIndex
DROP INDEX "Room_scrapeDate_idx";

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "address",
DROP COLUMN "amenities",
DROP COLUMN "currency",
DROP COLUMN "description",
DROP COLUMN "images",
DROP COLUMN "reviewCount",
DROP COLUMN "scrapeDate",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "roomName",
DROP COLUMN "roomsLeft",
DROP COLUMN "scrapeDate",
ADD COLUMN     "available" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Hotel_district_idx" ON "Hotel"("district");
