-- CreateTable
CREATE TABLE "Hotel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "location" TEXT,
    "address" TEXT,
    "district" TEXT,
    "scrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAvailableRooms" INTEGER NOT NULL DEFAULT 0,
    "minRoomPrice" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'TRY',
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "amenities" TEXT,
    "images" TEXT,
    "description" TEXT,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "hotelId" INTEGER NOT NULL,
    "roomName" TEXT NOT NULL,
    "roomsLeft" INTEGER NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION,
    "originalPrice" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'TRY',
    "mealPlan" TEXT,
    "cancelPolicy" TEXT,
    "occupancy" INTEGER,
    "hasPromotion" BOOLEAN NOT NULL DEFAULT false,
    "promotionDetails" TEXT,
    "scrapeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hotel_name_idx" ON "Hotel"("name");

-- CreateIndex
CREATE INDEX "Hotel_district_idx" ON "Hotel"("district");

-- CreateIndex
CREATE INDEX "Hotel_scrapeDate_idx" ON "Hotel"("scrapeDate");

-- CreateIndex
CREATE INDEX "Room_hotelId_idx" ON "Room"("hotelId");

-- CreateIndex
CREATE INDEX "Room_scrapeDate_idx" ON "Room"("scrapeDate");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
