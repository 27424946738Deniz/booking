require('dotenv').config();
const { scrapeHotels } = require('./scraper/scrapeHotels');
const logger = require('./utils/logger');
const { prisma, disconnectDatabase } = require('./models/database');

/**
 * Scraper uygulamasını başlat
 * @param {string} searchUrl - Booking.com arama URL'i
 */
async function start(searchUrl) {
  try {
    // Veritabanı bağlantısını kontrol et
    try {
      await prisma.$connect();
      logger.info('Veritabanı bağlantısı başarılı.');
    } catch (dbError) {
      logger.error(`Veritabanı bağlantısı başarısız: ${dbError.message}`);
      process.exit(1);
    }
    
    // Başlangıç zamanını kaydet
    const startTime = Date.now();
    
    // Scraping işlemini başlat
    const results = await scrapeHotels(searchUrl, {
      maxHotels: 100, // Maksimum otel sayısı
      maxPagesToLoad: 5, // Maksimum sayfa sayısı
    });
    
    // Bitiş zamanını hesapla
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - startTime) / 60000 * 10) / 10;
    
    // Sonuçları göster
    logger.info('================================================');
    logger.info(`Booking.com Scraper İşlem Özeti:`);
    logger.info('================================================');
    logger.info(`Toplam İşlenen Otel: ${results.totalHotels}`);
    logger.info(`Toplam Bulunan Oda: ${results.totalRooms}`);
    logger.info(`Toplam Hata: ${results.errors.length}`);
    logger.info(`İşlem Süresi: ${durationMinutes} dakika`);
    
    // En ucuz otelleri göster
    if (results.hotels.length > 0) {
      logger.info('\nEn Ucuz 5 Otel:');
      
      // Fiyatı olan otelleri filtrele ve sırala
      const sortedHotels = results.hotels
        .filter(hotel => hotel.minPrice && hotel.minPrice > 0)
        .sort((a, b) => a.minPrice - b.minPrice)
        .slice(0, 5);
      
      sortedHotels.forEach((hotel, index) => {
        logger.info(`${index + 1}. ${hotel.name} - Fiyat: ${hotel.minPrice} TL - Oda Sayısı: ${hotel.totalRooms}`);
      });
    }
    
    logger.info('================================================');
    
  } catch (error) {
    logger.error(`Uygulama hatası: ${error.message}`);
    process.exit(1);
  } finally {
    // Veritabanı bağlantısını kapat
    await disconnectDatabase();
  }
}

// Komut satırı argümanlarını işle
if (process.argv.length >= 3) {
  const searchUrl = process.argv[2];
  start(searchUrl);
} else {
  // Varsayılan URL
  const defaultUrl = 'https://www.booking.com/searchresults.html?ss=Istanbul&lang=tr';
  logger.info(`URL belirtilmedi, varsayılan URL kullanılıyor: ${defaultUrl}`);
  start(defaultUrl);
}

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