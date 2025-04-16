const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const path = require('path');

async function insertHotelsFromFile(filePath) {
  console.log(`--- insertHotelsFromFile function started with path: ${filePath} ---`);
  const prisma = new PrismaClient(); // Create client inside function
  let hotelsCreated = 0;
  let hotelsUpdated = 0;

  try {
    const hotelDetailsPath = path.resolve(process.cwd(), filePath);
    console.log(`Resolved path: ${hotelDetailsPath}`);
    const fileContent = await fs.readFile(hotelDetailsPath, 'utf8');
    const hotelSections = fileContent.split('===');

    const hotelsFromFile = [];
    const hotelNamesFromFile = new Set();

    // 1. Parse all hotels from file first
    for (const section of hotelSections) {
      if (!section.trim()) continue;
      const lines = section.trim().split('\n');
      const hotelData = {};
      for (const line of lines) {
        if (!line.trim()) continue;
        const [key, value] = line.split(': ').map(part => part.trim());
        if (key && value) {
          hotelData[key.toLowerCase()] = value;
        }
      }
      if (hotelData.name && hotelData.url) {
        hotelsFromFile.push(hotelData);
        hotelNamesFromFile.add(hotelData.name);
      }
    }
    console.log(`Parsed ${hotelsFromFile.length} hotels from file.`);

    // 2. Find existing hotels in bulk
    const existingHotels = await prisma.hotel.findMany({
      where: {
        name: {
          in: Array.from(hotelNamesFromFile),
        },
      },
      select: { id: true, name: true }, // Select only needed fields
    });

    const existingHotelsMap = new Map(existingHotels.map(h => [h.name, h.id]));
    console.log(`Found ${existingHotelsMap.size} existing hotels in the database.`);

    // 3. Prepare bulk operations
    const hotelsToCreate = [];
    const updatePromises = [];

    for (const hotelData of hotelsFromFile) {
      const existingId = existingHotelsMap.get(hotelData.name);
      const dataPayload = {
          name: hotelData.name,
          url: hotelData.url, // Make sure URL is updated/set correctly
          location: hotelData.location || null,
          rating: hotelData.rating ? parseFloat(hotelData.rating) : null
      };

      if (existingId) {
        // Prepare update
        updatePromises.push(
          prisma.hotel.update({
            where: { id: existingId },
            data: dataPayload, // Update all relevant fields
          })
        );
      } else {
        // Prepare create
        hotelsToCreate.push(dataPayload);
      }
    }

    // 4. Execute bulk create
    if (hotelsToCreate.length > 0) {
      const createResult = await prisma.hotel.createMany({
        data: hotelsToCreate,
        skipDuplicates: true, // Should not happen with our logic, but safe to keep
      });
      hotelsCreated = createResult.count;
      console.log(`Bulk created ${hotelsCreated} new hotels.`);
    }

    // 5. Execute updates in a transaction
    if (updatePromises.length > 0) {
      const updateResult = await prisma.$transaction(updatePromises);
      hotelsUpdated = updateResult.length;
      console.log(`Bulk updated ${hotelsUpdated} hotels.`);
    }

    console.log(`Finished processing. Created: ${hotelsCreated}, Updated: ${hotelsUpdated}`);

  } catch (error) {
    console.error('Error processing hotel details:', error);
    throw error; // Re-throw error for API handler
  } finally {
    await prisma.$disconnect();
    console.log("Prisma client disconnected.");
  }
}

// If this file is run directly, execute the insertion
// if (require.main === module) {
//   insertHotelsFromFile()
//     .catch(console.error);
// }

// Add command line argument handling
if (process.argv.length >= 3) {
  const filePath = process.argv[2];
  insertHotelsFromFile(filePath)
    .then(() => {
      console.log(`Successfully processed hotels from ${filePath}`);
    })
    .catch(error => {
      console.error('Error running script:', error);
      process.exit(1);
    });
} else {
  console.error('Please provide the input file path');
  console.log('Usage: node insert-hotels.js <input_file>');
  console.log('Example: node insert-hotels.js hotel_details.txt');
  process.exit(1);
}


module.exports = { insertHotelsFromFile }; 