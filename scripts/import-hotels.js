import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('Cleaning database...');
    // Delete in reverse order of dependency
    await prisma.room.deleteMany();
    console.log('Deleted rooms');
    await prisma.availability.deleteMany();
    console.log('Deleted availabilities');
    await prisma.hotel.deleteMany();
    console.log('Deleted hotels');
    console.log('Database cleaned successfully');
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error; // Re-throw the error to stop the import process
  }
}

async function importHotels() {
  let hotelsProcessed = 0;
  let hotelsCreated = 0;
  let hotelsSkipped = 0; // Counter for skipped duplicates
  
  try {
    console.log('Starting hotel import...');
    
    // Clean the database first
    //await cleanDatabase();
    
    const filePath = path.resolve(process.cwd(), 'hotel_details.txt');
    console.log(`Reading file from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentHotel = {};
    let lineCount = 0;

    for await (const line of rl) {
      lineCount++;
      if (line.trim() === '===') {
        hotelsProcessed++;
        // Process the completed hotel
        if (currentHotel.name && currentHotel.url) {
            const hotelData = {
                name: currentHotel.name,
                url: currentHotel.url,
                location: currentHotel.location || null,
                rating: currentHotel.rating ? parseFloat(currentHotel.rating) : null
            };

          try {
            // console.log(`Attempting to create hotel: ${hotelData.name} (URL: ${hotelData.url})`); // Uncomment for detailed logging
            await prisma.hotel.create({
              data: hotelData
            });
            hotelsCreated++;
            
            // Log progress every 100 hotels CREATED
            if (hotelsCreated > 0 && hotelsCreated % 100 === 0) {
              console.log(`Processed ${hotelsProcessed} sections, Created ${hotelsCreated} hotels, Skipped ${hotelsSkipped} duplicates`);
            }
          } catch (error) {
            if (error.code === 'P2002') { // Prisma unique constraint violation code
              console.warn(`Skipping duplicate URL found in file: ${hotelData.url} (Hotel: ${hotelData.name})`);
              hotelsSkipped++;
            } else {
              console.error(`Error creating hotel: ${hotelData.name} (URL: ${hotelData.url}) at line ~${lineCount}`, error);
              // Optionally decide if you want to stop on other errors
              // process.exit(1);
            }
          }
        } else {
            console.warn(`Skipping incomplete hotel data at line ~${lineCount}:`, currentHotel);
        }
        currentHotel = {}; // Reset for the next hotel
      } else {
        const parts = line.split(': ');
        if (parts.length >= 2) {
            const key = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(': ').trim(); // Handle cases where value might contain ':'
            if (key && value) {
              currentHotel[key] = value;
            }
        } else if (line.trim()) {
            // Handle potential malformed lines if necessary
            // console.warn(`Malformed line ${lineCount}: ${line.trim()}`);
        }
      }
    }

    // Process the last hotel if file doesn't end with ===
    if (Object.keys(currentHotel).length > 0 && currentHotel.name && currentHotel.url) {
        hotelsProcessed++;
        const hotelData = {
            name: currentHotel.name,
            url: currentHotel.url,
            location: currentHotel.location || null,
            rating: currentHotel.rating ? parseFloat(currentHotel.rating) : null
        };
        try {
            await prisma.hotel.create({ data: hotelData });
            hotelsCreated++;
        } catch (error) {
            if (error.code === 'P2002') {
                console.warn(`Skipping duplicate URL found in file (last hotel): ${hotelData.url} (Hotel: ${hotelData.name})`);
                hotelsSkipped++;
            } else {
                console.error(`Error creating last hotel: ${hotelData.name} (URL: ${hotelData.url})`, error);
            }
        }
    }

    console.log('-------------------------------');
    console.log('Import completed!');
    console.log(`Total sections processed in file: ${hotelsProcessed}`);
    console.log(`Hotels successfully created: ${hotelsCreated}`);
    console.log(`Duplicate URLs skipped: ${hotelsSkipped}`);
    console.log('-------------------------------');

  } catch (error) {
    // Catch errors from cleanDatabase or file reading
    console.error('Fatal error during import process:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

importHotels(); 