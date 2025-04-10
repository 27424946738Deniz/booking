const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Booking.com URL'sini temizle ve normalize et
 * @param {string} url - Temizlenecek URL
 * @returns {string} Temizlenmiş URL
 */
function cleanBookingUrl(url) {
  try {
    const urlObj = new URL(url);
    // Sadece domain ve pathname'i al, tüm parametreleri temizle
    let cleanUrl = urlObj.origin + urlObj.pathname;
    // Sondaki slash'i kaldır
    cleanUrl = cleanUrl.replace(/\/$/, '');
    // .html uzantısını kaldır
    cleanUrl = cleanUrl.replace(/\.html$/, '');
    // .tr uzantısını kaldır
    cleanUrl = cleanUrl.replace(/\.tr$/, '');
    // Tüm URL'yi küçük harfe çevir
    cleanUrl = cleanUrl.toLowerCase();
    return cleanUrl;
  } catch (error) {
    logger.warn(`URL temizleme hatası: ${error.message}`);
    return url;
  }
}

/**
 * Otel verilerini veritabanına kaydetme
 * @param {Object} hotelData - Otel verileri
 * @returns {Promise<Object>} Kaydedilen otel
 */
async function saveHotelData(hotelData) {
  try {
    logger.info(`"${hotelData.name}" oteli veritabanına kaydediliyor...`);
    logger.info(`Orijinal URL: ${hotelData.url}`);
    
    // URL'yi temizle
    const cleanUrl = cleanBookingUrl(hotelData.url);
    logger.info(`Temizlenmiş URL: ${cleanUrl}`);
    
    // URL kontrolü
    const existingHotel = await prisma.hotel.findFirst({
      where: { url: cleanUrl }
    });
    
    if (existingHotel) {
      // Otel zaten varsa güncelle
      logger.info(`Otel zaten var, güncelleniyor: ${hotelData.name} (ID: ${existingHotel.id})`);
      
      const updatedHotel = await prisma.hotel.update({
        where: { id: existingHotel.id },
        data: {
          name: hotelData.name,
          location: hotelData.location,
          rating: hotelData.rating,
          minPrice: hotelData.minPrice,
          totalAvailableRooms: hotelData.totalAvailableRooms || 0,
          currency: hotelData.currency || 'TRY'
        }
      });
      
      logger.info(`"${hotelData.name}" otel bilgileri güncellendi, ID: ${updatedHotel.id}`);
      return updatedHotel;
    } else {
      // Yeni otel oluştur
      const hotel = await prisma.hotel.create({
        data: {
          name: hotelData.name,
          url: cleanUrl,  // Temizlenmiş URL'yi kullan
          location: hotelData.location,
          rating: hotelData.rating,
          minPrice: hotelData.minPrice,
          totalAvailableRooms: hotelData.totalAvailableRooms || 0,
          currency: hotelData.currency || 'TRY'
        }
      });
      
      logger.info(`"${hotelData.name}" otel bilgileri kaydedildi, ID: ${hotel.id}`);
      return hotel;
    }
  } catch (error) {
    logger.error(`Otel verileri kaydedilirken hata oluştu: ${error.message}`);
    throw error;
  }
}

/**
 * Oda verilerini veritabanına kaydetme
 * @param {number} hotelId - Otel ID
 * @param {Array} rooms - Oda verileri
 */
async function saveRoomData(hotelId, rooms) {
  try {
    if (!rooms || rooms.length === 0) {
      logger.warn(`Otel ID ${hotelId} için kaydedilecek oda yok.`);
      return [];
    }
    
    logger.info(`Otel ID ${hotelId} için ${rooms.length} oda bilgisi kaydediliyor...`);
    
    // Önce mevcut odaları temizle
    await prisma.room.deleteMany({
      where: { hotelId }
    });
    
    // Yeni oda bilgilerini kaydet
    const roomsData = rooms.map(room => ({
      hotelId: hotelId,
      roomName: room.roomName,
      roomsLeft: room.roomsLeft || 0,
      price: room.price,
      originalPrice: room.originalPrice,
      currency: room.currency || 'TRY',
      mealPlan: room.mealPlan,
      cancelPolicy: room.cancelPolicy
    }));
    
    await prisma.room.createMany({
      data: roomsData
    });
    
    logger.info(`Otel ID ${hotelId} için ${rooms.length} oda bilgisi başarıyla kaydedildi.`);
    return roomsData;
  } catch (error) {
    logger.error(`Oda verileri kaydedilirken hata oluştu: ${error.message}`);
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

module.exports = {
  saveHotelData,
  saveRoomData,
  disconnectDatabase,
  prisma
}; 