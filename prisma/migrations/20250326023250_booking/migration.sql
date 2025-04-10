/*
  Warnings:

  - You are about to drop the column `address` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `amenities` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `minRoomPrice` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `reviewCount` on the `Hotel` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Hotel_district_idx";

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "address",
DROP COLUMN "amenities",
DROP COLUMN "description",
DROP COLUMN "district",
DROP COLUMN "images",
DROP COLUMN "minRoomPrice",
DROP COLUMN "reviewCount",
ADD COLUMN     "minPrice" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Hotel_location_idx" ON "Hotel"("location");
