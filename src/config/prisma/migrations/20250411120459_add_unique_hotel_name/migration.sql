/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Hotel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[url]` on the table `Hotel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Hotel_name_key" ON "Hotel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_url_key" ON "Hotel"("url");
