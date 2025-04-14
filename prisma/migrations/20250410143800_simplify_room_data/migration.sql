/*
  Warnings:

  - You are about to drop the `RoomDailyData` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RoomDailyData" DROP CONSTRAINT "RoomDailyData_roomId_fkey";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "lastScrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "roomsLeft" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "RoomDailyData";
