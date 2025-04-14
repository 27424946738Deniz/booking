require('dotenv').config();
const { disconnectDatabase, prisma } = require('./data/database');
const logger = require('./utils/logger');
const { runScraper } = require("./scraper/run_room_scraper_specific.cjs")

/**
 * Oda scraper uygulamasını başlat
 * @param {string} linksFile - Otel linklerini içeren dosyanın yolu
 */
async function start() {
  try {
    // Veritabanı bağlantısını kontrol et
    try {
      await prisma.$connect();
      logger.info('Veritabanı bağlantısı başarılı');
    } catch (dbError) {
      logger.error(`Veritabanı bağlantısı başarısız: ${dbError.message}`);
      process.exit(1);
    }
    
    // Başlangıç zamanını kaydet
    const startTime = Date.now();
    
    // Scraping işlemini başlat
    const results = await runScraper();
    
    // Sonuçları veritabanına kaydet
    let successCount = 0;
    let errorCount = 0;
    let totalRooms = 0;
    
    // for (const hotelData of results) {
    //   try {
    //     if (hotelData.error) {
    //       errorCount++;
    //       continue;
    //     }
        
    //     await saveHotelRoomData(hotelData);
    //     successCount++;
    //     totalRooms += hotelData.totalAvailableRooms;
    //   } catch (error) {
    //     logger.error(`Otel kaydedilirken hata (${hotelData.url}): ${error.message}`);
    //     errorCount++;
    //   }
    // }
    
    // Bitiş zamanını hesapla
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - startTime) / 60000 * 10) / 10;
    
    // Sonuçları göster
    logger.info('================================================');
    logger.info('Booking.com Oda Scraper İşlem Özeti:');
    logger.info('================================================');
    logger.info(`Toplam İşlenen Otel: ${results.length}`);
    logger.info(`Başarılı: ${successCount}`);
    logger.info(`Hatalı: ${errorCount}`);
    logger.info(`Toplam Bulunan Oda: ${totalRooms}`);
    logger.info(`İşlem Süresi: ${durationMinutes} dakika`);
    logger.info('================================================');
    
  } catch (error) {
    logger.error(`Uygulama hatası: ${error.message}`);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

// // Komut satırı argümanlarını işle
// if (process.argv.length >= 3) {
//   //const linksFile = path.resolve(process.argv[2]);
//   start();
// } else {
//   logger.error('Link dosyası belirtilmedi!');
//   logger.info('Kullanım: node src/room-scraper/index.js <links_file>');
//   logger.info('Örnek: node src/room-scraper/index.js hotel_links.txt');
//   process.exit(1);
// }

start();

// Kapanma sinyallerini yakala
process.on('SIGINT', async () => {
  logger.info('Uygulama kapatılıyor...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Uygulama kapatılıyor...');
  await disconnectDatabase();
  process.exit(0);
}); 