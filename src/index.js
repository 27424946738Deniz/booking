require('dotenv').config();
const { scrapeHotels } = require('./scraper/scrapeHotels');
const logger = require('./utils/logger');
// Spesifik URL'i tanımla
const specificSearchUrl = 'https://www.booking.com/searchresults.tr.html?label=gen173nr-1BCAso5AFCFnNoZXJhdG9uLWlzdGFuYnVsLWNpdHlIM1gEaKkBiAEBmAEouAEYyAEM2AEB6AEBiAIBqAIEuAL0kdi_BsACAdICJDZhN2NmNzJkLWNmNDAtNDk0NS1iM2Y5LTA5NzI3MzZhNWY3NdgCBeACAQ&sid=e082a73bda0b0c5924a050a08177296b&aid=304142&ss=%C4%B0stanbul&ssne=%C4%B0stanbul&ssne_untouched=%C4%B0stanbul&lang=tr&src=index&dest_id=-755070&dest_type=city&checkin=2025-04-09&checkout=2025-04-10&group_adults=2&no_rooms=1&group_children=0&nflt=price%3DEUR-80-85-1';

/**
 * Belirtilen tek bir URL için otelleri scrape eden ana fonksiyon.
 */
async function runSingleUrlScraping() {
  logger.info('Tek URL için otel scraping işlemi başlatılıyor...');
  logger.info(`URL: ${specificSearchUrl}`);
  const overallStartTime = Date.now();
  let totalHotelsScraped = 0;
  let totalErrors = 0;

  try {
    const results = await scrapeHotels(specificSearchUrl, {
      maxHotels: 1000, // Bu ayarları isterseniz değiştirebilirsiniz
      maxPagesToLoad: 50,
    });

    totalHotelsScraped = results.totalHotels;
    totalErrors = results.errors.length;

  } catch (error) {
    logger.error(`URL işlenirken hata: ${error.message}`);
    totalErrors++; // Genel hata sayacını artır
  }

  const overallEndTime = Date.now();
  const overallDurationMinutes = Math.round((overallEndTime - overallStartTime) / 60000 * 10) / 10;
  logger.info('================================================');
  logger.info('İşlem Özeti:');
  logger.info('================================================');
  logger.info(`Toplam İşlenen Otel: ${totalHotelsScraped}`);
  logger.info(`Toplam Hata: ${totalErrors}`);
  logger.info(`Toplam Süre: ${overallDurationMinutes} dakika`);
  logger.info('================================================');
  logger.info(`Dosya çıktıları (veriler eklenerek yazıldı):`);
  logger.info(`- hotel_details.txt: Otel detaylarını içerir`);
  logger.info(`- hotel_links.txt: Room scraper için URL listesini içerir`);
  logger.info('================================================');
}

// Uygulamayı başlat
runSingleUrlScraping().catch(err => {
  logger.error(`Beklenmedik genel hata: ${err.message}`);
  process.exit(1);
});

// Kapanma sinyallerini yakala (readline kaldırıldığı için rl.close() gerekmez)
process.on('SIGINT', async () => {
  logger.info('Uygulama kapatılıyor (SIGINT)...');
  // Gerekirse burada ek temizleme işlemleri yapılabilir
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Uygulama kapatılıyor (SIGTERM)...');
  // Gerekirse burada ek temizleme işlemleri yapılabilir
  process.exit(0);
});