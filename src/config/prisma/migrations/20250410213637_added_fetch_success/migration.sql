/*
  Warnings:

  - Added the required column `fetchSuccess` to the `Availability` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Availability" ADD COLUMN     "fetchSuccess" BOOLEAN NOT NULL;
