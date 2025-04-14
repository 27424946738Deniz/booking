const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function insertHotelsFromFile(filePath) {
  try {
    const hotelDetailsPath = path.resolve(process.cwd(), filePath);
    const fileContent = await fs.readFile(hotelDetailsPath, 'utf8');
    const hotelSections = fileContent.split('===');

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

      console.log(hotelData);

      if (hotelData.name && hotelData.url) {
        const existingHotel = await prisma.hotel.findFirst({
          where: { name: hotelData.name }
        });

        if (existingHotel) {
          await prisma.hotel.update({
            where: { id: existingHotel.id },
            data: {
              name: hotelData.name,
              location: hotelData.location || null,
              rating: hotelData.rating ? parseFloat(hotelData.rating) : null
            }
          });
        } else {
          await prisma.hotel.create({
            data: {
              name: hotelData.name,
              url: hotelData.url,
              location: hotelData.location || null,
              rating: hotelData.rating ? parseFloat(hotelData.rating) : null
            }
          });
        }
      }
    }
    console.log('Hotels have been successfully inserted/updated in the database');
  } catch (error) {
    console.error('Error processing hotel details:', error);
  } finally {
    await prisma.$disconnect();
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