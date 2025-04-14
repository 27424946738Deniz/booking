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
 * Otel oda bilgilerini veritabanına kaydet
 * @param {Object} hotelData - Otel ve oda bilgileri
 * @returns {Promise<Object>} Kaydedilen otel
 */
async function saveHotelRoomData(hotelData) {
  try {
    logger.info(`"${hotelData.hotelName}" için oda bilgileri kaydediliyor...`);
    logger.info(`Orijinal URL: ${hotelData.url}`);
    
    // URL'yi temizle
    const cleanUrl = cleanBookingUrl(hotelData.url);
    logger.info(`Temizlenmiş URL: ${cleanUrl}`);
    
    // Önce oteli ara
    let hotel = await prisma.hotel.findFirst({
      where: {
        url: cleanUrl
      }
    });
    
    // Eğer otel varsa güncelle, yoksa oluştur
    if (hotel) {
      logger.info(`Mevcut otel bulundu, ID: ${hotel.id}, güncelleniyor...`);
      
      hotel = await prisma.hotel.update({
        where: {
          id: hotel.id
        },
        data: {
          name: hotelData.hotelName,
          totalAvailableRooms: hotelData.totalAvailableRooms,
          minPrice: hotelData.minPrice,
          scrapeDate: new Date(),
          location: hotel.location || undefined,
          rating: hotel.rating || undefined
        }
      });
      
      logger.info(`Otel güncellendi, ID: ${hotel.id}`);
    } else {
      logger.info(`Otel veritabanında bulunamadı, yeni kayıt oluşturuluyor...`);
      
      hotel = await prisma.hotel.create({
        data: {
          name: hotelData.hotelName,
          url: cleanUrl,
          totalAvailableRooms: hotelData.totalAvailableRooms,
          minPrice: hotelData.minPrice,
          scrapeDate: new Date()
        }
      });
      
      logger.info(`Yeni otel oluşturuldu, ID: ${hotel.id}`);
    }
    
    // Hotel ID kontrolü
    if (!hotel || !hotel.id) {
      throw new Error('Otel kaydı oluşturulamadı veya ID bulunamadı');
    }
    
    // Mevcut odaları sil
    const deletedRooms = await prisma.room.deleteMany({
      where: {
        hotelId: hotel.id
      }
    });
    
    logger.info(`${deletedRooms.count} eski oda kaydı silindi`);
    
    // Yeni oda bilgilerini kaydet
    if (hotelData.rooms && hotelData.rooms.length > 0) {
      const roomsData = hotelData.rooms.map(room => ({
        hotelId: hotel.id,
        roomName: room.roomName,
        roomsLeft: room.availableRooms,
        price: room.price,
        currency: 'TRY',
        scrapeDate: new Date()
      }));
      
      const result = await prisma.room.createMany({
        data: roomsData
      });
      
      logger.info(`"${hotelData.hotelName}" için ${result.count} oda bilgisi kaydedildi`);
    } else {
      logger.warn(`"${hotelData.hotelName}" için oda bilgisi bulunamadı`);
    }
    
    return hotel;
  } catch (error) {
    logger.error(`Oda bilgileri kaydedilirken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Veritabanı bağlantısını kapat
 */
async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Veritabanı bağlantısı başarıyla kapatıldı');
  } catch (error) {
    logger.error(`Veritabanı bağlantısı kapatılırken hata: ${error.message}`);
  }
}

module.exports = {
  saveHotelRoomData,
  disconnectDatabase,
  prisma
}; 