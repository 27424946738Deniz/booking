/*
  Warnings:

  - The `amenities` column on the `Hotel` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `images` column on the `Hotel` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `cancelPolicy` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `hasPromotion` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `mealPlan` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `occupancy` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `originalPrice` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `promotionDetails` on the `Room` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[url]` on the table `Hotel` will be added. If there are existing duplicate values, this will fail.
  - Made the column `url` on table `Hotel` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Hotel_district_idx";

-- AlterTable
ALTER TABLE "Hotel" ALTER COLUMN "url" SET NOT NULL,
DROP COLUMN "amenities",
ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "images",
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "cancelPolicy",
DROP COLUMN "currency",
DROP COLUMN "hasPromotion",
DROP COLUMN "mealPlan",
DROP COLUMN "occupancy",
DROP COLUMN "originalPrice",
DROP COLUMN "promotionDetails";

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_url_key" ON "Hotel"("url");
