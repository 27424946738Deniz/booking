// src/scripts/reorder_hotels_force_sequential.js
// WARNING: THIS SCRIPT PERFORMS DESTRUCTIVE OPERATIONS.
// IT DELETES ALL AVAILABILITY AND HOTEL DATA BEFORE RE-INSERTING.
// IT ALSO USES RAW SQL WHICH MAY BE DATABASE-DEPENDENT.
// REVIEW CAREFULLY AND UNCOMMENT THE DESTRUCTIVE STEPS AT YOUR OWN RISK.
// ENSURE YOU HAVE A DATABASE BACKUP BEFORE RUNNING.

const { PrismaClient } = require('@prisma/client');
const bookingList = require('../scraper/booking-list.cjs'); // Adjust path if needed

const prisma = new PrismaClient();

async function forceSequentialHotelIds() {
  console.log('--- Starting forceful hotel ID reordering ---');
  console.log('Step 1: Fetching existing hotel data...');

  let currentHotels = [];
  try {
    // Fetch all hotels ordered by their current ID to preserve relative order if needed,
    // but we primarily rely on bookingList for the final order.
    currentHotels = await prisma.hotel.findMany({
      orderBy: {
        id: 'asc',
      },
      select: {
        // Select all fields EXCEPT id
        url: true,
        name: true,
        location: true,
        rating: true,
        image_url: true,
        description: true,
        amenities: true,
        // Add any other fields your Hotel model has
      },
    });
    console.log(`Fetched ${currentHotels.length} hotels from the database.`);
  } catch (error) {
    console.error('Error fetching current hotels:', error);
    throw error; // Stop execution if fetching fails
  }

  if (currentHotels.length === 0) {
      console.log("No hotels found in the database. Nothing to reorder.");
      return;
  }

  console.log('Step 2: Reading definitive order from booking-list.cjs...');
  const targetUrlOrder = bookingList;
  console.log(`Found ${targetUrlOrder.length} URLs in booking-list.cjs.`);

  if (targetUrlOrder.length === 0) {
      console.log("booking-list.cjs is empty. Cannot determine order.");
      return;
  }

  console.log('Step 3: Matching and ordering hotel data...');
  const hotelsByUrl = new Map();
  currentHotels.forEach(hotel => {
    // Normalize URL if necessary, e.g., remove trailing slashes
    const normalizedUrl = hotel.url?.trim().replace(/\/$/, '');
    if (normalizedUrl) {
        hotelsByUrl.set(normalizedUrl, hotel);
    } else {
        console.warn(`Found hotel with missing or invalid URL: ${JSON.stringify(hotel)}`);
    }
  });

  const orderedHotelData = [];
  let notFoundCount = 0;
  targetUrlOrder.forEach((url, index) => {
    const normalizedUrl = url?.trim().replace(/\/$/, '');
    const hotelData = hotelsByUrl.get(normalizedUrl);
    if (hotelData) {
      orderedHotelData.push(hotelData); // Add the data object (without ID)
    } else {
      console.warn(`URL from booking-list.cjs at index ${index} not found in database: ${url}`);
      notFoundCount++;
      // Decide how to handle missing URLs:
      // Option A: Skip (as implemented)
      // Option B: Add a placeholder entry (e.g., orderedHotelData.push({ url: url, name: `Missing Hotel ${index + 1}` }))
      // Option C: Stop execution (throw new Error(...))
    }
  });
  console.log(`Prepared ${orderedHotelData.length} hotel data entries in the target order.`);
  if (notFoundCount > 0) {
      console.warn(`${notFoundCount} URLs from booking-list.cjs were not found in the current hotel data.`);
  }
   if (orderedHotelData.length === 0) {
      console.error("No matching hotel data found based on booking-list.cjs. Aborting.");
      return;
   }

  // --- DESTRUCTIVE OPERATIONS BELOW ---
  // --- REVIEW AND UNCOMMENT CAREFULLY ---

  console.log(`
--- PREVIEW OF DESTRUCTIVE OPERATIONS ---`);
  console.log(`WARNING: The next steps will DELETE data.`);
  console.log(`Preview Step 4: Would delete ALL records from 'Availability' table.`);
  console.log(`Preview Step 5: Would delete ALL ${orderedHotelData.length} records from 'Hotel' table.`);
  console.log(`Preview Step 6: Would reset 'Hotel' ID sequence (assuming PostgreSQL: ALTER SEQUENCE "Hotel_id_seq" RESTART WITH 1;).`);
  console.log(`Preview Step 7: Would re-insert ${orderedHotelData.length} hotels sequentially.`);

  // --- UNCOMMENT BLOCK TO EXECUTE ---

  try {
    console.log('\nStep 4: Deleting ALL Availability records...');
    const deletedAvail = await prisma.availability.deleteMany({});
    console.log(`Deleted ${deletedAvail.count} Availability records.`);
    // Add deleteMany for any other tables referencing Hotel.id

    console.log('Step 5: Deleting ALL Hotel records...');
    const deletedHotels = await prisma.hotel.deleteMany({});
    console.log(`Deleted ${deletedHotels.count} Hotel records.`);

    console.log('Step 6: Resetting Hotel ID sequence (PostgreSQL)...');
    // IMPORTANT: Replace with correct command for your database if not PostgreSQL
    await prisma.$executeRawUnsafe('ALTER SEQUENCE "Hotel_id_seq" RESTART WITH 1;');
    console.log('Hotel ID sequence reset.');

    console.log('Step 7: Re-inserting hotels sequentially...');
    let insertedCount = 0;
    for (const hotelData of orderedHotelData) {
      const createdHotel = await prisma.hotel.create({
        data: hotelData, // Contains url, name, rating, etc.
      });
      insertedCount++;
       // Optional: Log progress less frequently
       if (insertedCount % 100 === 0 || insertedCount === orderedHotelData.length) {
           console.log(`Inserted hotel ${insertedCount}/${orderedHotelData.length} (New ID: ${createdHotel.id})`);
       }
    }
    console.log(`Successfully re-inserted ${insertedCount} hotels with sequential IDs.`);

  } catch (error) {
    console.error('!!! ERROR DURING DESTRUCTIVE OPERATIONS !!!');
    console.error('The database might be in an inconsistent state.');
    console.error(error);
    // Consider adding manual recovery steps here if needed.
  }

  // --- END OF UNCOMMENT BLOCK ---
}

forceSequentialHotelIds()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('--- Script finished ---');
  }); 