/*
  Warnings:

  - You are about to drop the column `minPrice` on the `Hotel` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Hotel_location_idx";

-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "minPrice",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "amenities" TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "minRoomPrice" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER;

-- CreateIndex
CREATE INDEX "Hotel_district_idx" ON "Hotel"("district");
