import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('Starting database cleanup...');

    // Delete all rooms first (due to foreign key constraints)
    const roomsDeleted = await prisma.room.deleteMany();
    console.log(`Deleted ${roomsDeleted.count} rooms`);

    // Then delete all availabilities
    const availabilitiesDeleted = await prisma.availability.deleteMany();
    console.log(`Deleted ${availabilitiesDeleted.count} availabilities`);

    // Finally delete all hotels
    const hotelsDeleted = await prisma.hotel.deleteMany();
    console.log(`Deleted ${hotelsDeleted.count} hotels`);

    console.log('Database cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase(); 