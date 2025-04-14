import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicateHotels() {
  try {
    console.log('Starting duplicate cleanup...');

    // Get all hotels grouped by URL with count
    const duplicates = await prisma.$queryRaw`
      SELECT url, COUNT(*) as count
      FROM Hotel
      GROUP BY url
      HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} URLs with duplicate entries`);

    for (const duplicate of duplicates) {
      const { url } = duplicate;

      // Get all hotels with this URL, ordered by ID (assuming later IDs are more recent)
      const hotels = await prisma.hotel.findMany({
        where: { url },
        orderBy: { id: 'desc' },
      });

      // Keep the first one (most recent) and delete the rest
      const [keep, ...remove] = hotels;
      
      if (remove.length > 0) {
        const removeIds = remove.map(h => h.id);
        
        // Delete duplicate entries
        await prisma.hotel.deleteMany({
          where: { id: { in: removeIds } },
        });

        console.log(`Deleted ${remove.length} duplicates for URL: ${url}`);
      }
    }

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicateHotels(); 