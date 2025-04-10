const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteHotels() {
  try {
    // Önce bu otellere ait odaları sil
    const deletedRooms = await prisma.room.deleteMany({
      where: {
        hotelId: {
          lte: 961
        }
      }
    });
    
    console.log(`${deletedRooms.count} oda silindi`);

    // Sonra otelleri sil
    const deletedHotels = await prisma.hotel.deleteMany({
      where: {
        id: {
          lte: 961
        }
      }
    });
    
    console.log(`${deletedHotels.count} otel silindi`);

  } catch (error) {
    console.error('Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteHotels(); 