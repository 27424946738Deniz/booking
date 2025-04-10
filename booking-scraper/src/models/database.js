const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Otel verilerini veritabanına kaydetme
 * @param {Object} hotelData - Otel verileri
 * @returns {Promise<Object>} Kaydedilen otel
 */
async function saveHotelData(hotelData) {
  try {
    logger.info(`"${hotelData.name}" oteli veritabanına kaydediliyor...`);
    
    // Önce otel bilgilerini kaydet
    const hotel = await prisma.hotel.create({
      data: {
        name: hotelData.name,
        url: hotelData.url,
        location: hotelData.location,
        address: hotelData.address,
        district: hotelData.district,
        scrapeDate: new Date(),
        totalAvailableRooms: hotelData.totalAvailableRooms || 0,
        minRoomPrice: hotelData.minRoomPrice,
        currency: hotelData.currency || 'TRY',
        rating: hotelData.rating,
        reviewCount: hotelData.reviewCount,
        amenities: hotelData.amenities || [],
        images: hotelData.images || [],
        description: hotelData.description
      }
    });
    
    logger.info(`"${hotelData.name}" otel bilgileri kaydedildi, ID: ${hotel.id}`);
    
    // Eğer oda bilgileri varsa kaydet
    if (hotelData.rooms && hotelData.rooms.length > 0) {
      logger.info(`"${hotelData.name}" için ${hotelData.rooms.length} oda bilgisi kaydediliyor...`);
      
      // Oda bilgilerini toplu kaydetme
      const roomsData = hotelData.rooms.map(room => ({
        hotelId: hotel.id,
        roomName: room.roomName,
        roomsLeft: room.roomsLeft || 0,
        price: room.price,
        originalPrice: room.originalPrice,
        currency: room.currency || 'TRY',
        mealPlan: room.mealPlan,
        cancelPolicy: room.cancelPolicy,
        occupancy: room.occupancy,
        hasPromotion: !!room.hasPromotion,
        promotionDetails: room.promotionDetails
      }));
      
      // Toplu oda ekleme işlemi
      await prisma.room.createMany({
        data: roomsData
      });
      
      logger.info(`"${hotelData.name}" için ${hotelData.rooms.length} oda bilgisi başarıyla kaydedildi.`);
    }
    
    return hotel;
  } catch (error) {
    logger.error(`Otel verileri kaydedilirken hata oluştu: ${error.message}`);
    throw error;
  }
}

/**
 * Veritabanı bağlantısını kapatma
 */
async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Veritabanı bağlantısı başarıyla kapatıldı');
  } catch (error) {
    logger.error(`Veritabanı bağlantısı kapatılırken hata oluştu: ${error.message}`);
  }
}

/**
 * Veritabanından bugün kaydedilen otelleri sayma
 * @returns {Promise<number>} Bugün kaydedilen otel sayısı
 */
async function getTodayHotelCount() {
  try {
    // Bugünün başlangıcını al
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Yarının başlangıcını al
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Bugün kaydedilen otelleri say
    const count = await prisma.hotel.count({
      where: {
        scrapeDate: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    return count;
  } catch (error) {
    logger.error(`Bugünkü otel sayısı alınırken hata oluştu: ${error.message}`);
    return 0;
  }
}

module.exports = {
  saveHotelData,
  disconnectDatabase,
  getTodayHotelCount,
  prisma
}; 