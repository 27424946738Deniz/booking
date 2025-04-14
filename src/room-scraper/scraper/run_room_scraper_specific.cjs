console.log("--- SCRIPT BAŞLADI ---");
// require('dotenv').config();
const path = require('path');
// const Piscina = require('piscina'); // Bu satır 11. satırda zaten var, kaldırıldı.
const os = require('os');
const logger = require('../../utils/logger.cjs');
const { PrismaClient } = require('@prisma/client');
const bookingList = require("../booking-list.cjs");
const { updateLinkDatesFromArray } = require('../../utils/update_link_dates.cjs');
const piscina = require('piscina');

// --- Ayarlar ---
// const inputFile = path.resolve(__dirname, '../../..', 'extracted_hotel_links_10-11_april_top20.txt'); // Removed file dependency
const numWorkers = Math.max(1, os.cpus().length - 1); // Dynamic worker count per app instance
const separator = '==================================================';

// --- Ortam Değişkenlerinden Dağıtım Ayarlarını Oku ---
const totalApps = parseInt(process.env.TOTAL_APPS, 10);
const appIndex = parseInt(process.env.APP_INDEX, 10);

if (isNaN(totalApps) || isNaN(appIndex) || totalApps <= 0 || appIndex < 0 || appIndex >= totalApps) {
    logger.error('Geçersiz TOTAL_APPS veya APP_INDEX ortam değişkenleri. Lütfen kontrol edin.');
    process.exit(1);
}

logger.info(`Room scraper başlatılıyor (Piscina - Prisma Veritabanı Kaydı)...`);
logger.info(`Toplam Uygulama Sayısı (TOTAL_APPS): ${totalApps}`);
logger.info(`Bu Uygulamanın İndeksi (APP_INDEX): ${appIndex}`);
// logger.info(`Kullanılacak link dosyası: ${inputFile}`); // Removed
logger.info(`Worker sayısı (bu instance için): ${numWorkers}`);

const prisma = new PrismaClient();

// --- Bu gereksiz piscina örneğini kaldır --- 
// const piscina = new Piscina({
//   filename: path.resolve(__dirname, '../worker.cjs'),
//   minThreads: numWorkers,
//   maxThreads: numWorkers,
// });
// ---

async function runScraper() {
  const overallStartTime = Date.now();
  const allResults = [];
  let totalRoomsSaved = 0;
  let totalRoomsFound = 0;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  logger.info(`Date objects created.`);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  logger.info(`formatDate function defined.`);

  const checkinDate = formatDate(today);
  const checkoutDate = formatDate(tomorrow);
  logger.info(`Using checkinDate: ${checkinDate}, checkoutDate: ${checkoutDate}`);

  let allHotelLinks;
  logger.info(`Attempting to update link dates...`);
  try {
    allHotelLinks = updateLinkDatesFromArray(bookingList, checkinDate, checkoutDate);
    if (!allHotelLinks) {
      logger.error("updateLinkDatesFromArray returned undefined or null.");
      allHotelLinks = []; // Prevent downstream errors
    }
    logger.info(`updateLinkDatesFromArray returned ${allHotelLinks.length} links.`);
  } catch (error) {
    logger.error(`Error calling updateLinkDatesFromArray: ${error.message}`, error);
    allHotelLinks = []; // Prevent downstream errors on failure
    logger.info(`Proceeding with empty link list due to error.`);
  }

  const totalLinkCountGlobal = allHotelLinks.length;
  logger.info(`Total global links after date update: ${totalLinkCountGlobal}`);

  if (totalLinkCountGlobal === 0) {
    logger.info('İşlenecek link bulunamadı.');
    await prisma.$disconnect();
    return;
  }

  const linksPerApp = Math.ceil(totalLinkCountGlobal / totalApps);
  const startIndex = appIndex * linksPerApp;
  const endIndex = Math.min(startIndex + linksPerApp, totalLinkCountGlobal);
  logger.info(`Calculated indices: startIndex=${startIndex}, endIndex=${endIndex}`);

  const hotelLinks = allHotelLinks.slice(startIndex, endIndex);
  const totalLinksForThisApp = hotelLinks.length;
  logger.info(`Total links for this app instance (${appIndex}): ${totalLinksForThisApp}`);

  if (totalLinksForThisApp === 0) {
    logger.info('Bu uygulama için işlenecek link yok.');
    await prisma.$disconnect();
    return;
  }
  logger.info(`Proceeding to create worker pool for ${totalLinksForThisApp} links.`);

  const pool = new piscina.Piscina({
    filename: path.resolve(__dirname, '../worker.cjs'),
    minThreads: Math.min(10, totalLinksForThisApp),
    maxThreads: Math.min(10, totalLinksForThisApp),
  });

  const tasks = hotelLinks.map((url, index) => {
    const workerData = {
      url: url,
      index: startIndex + index + 1,
      totalCount: totalLinkCountGlobal,
      env: {
        DATABASE_URL: process.env.DATABASE_URL,
        TIMEOUT: process.env.TIMEOUT || '120000',
        DISABLE_IMAGES: process.env.DISABLE_IMAGES,
        USER_AGENT: process.env.USER_AGENT
      }
    };
    return pool.run(workerData)
      .catch(error => {
        logger.error(`Worker görevi hatası (${url}): ${error.message}`, { stack: error.stack });
        return { index: startIndex + index + 1, url: url, status: 'FAILED', error: error.message, savedRoomCount: 0, foundRoomCount: 0, durationMs: 0 };
      });
  });

  logger.info(`Bu uygulama için ${tasks.length} görev worker havuzuna gönderildi, sonuçlar bekleniyor...`);
  const settledResults = await Promise.allSettled(tasks);
  logger.info('Bu uygulama için tüm görevler tamamlandı.');

  settledResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      allResults.push(result.value);
      if (result.value.status === 'SUCCESS') {
        totalRoomsSaved += result.value.savedRoomCount || 0;
        totalRoomsFound += result.value.foundRoomCount || 0;
      }
    } else {
      const errorResult = {
        index: startIndex + i + 1,
        url: hotelLinks[i],
        status: 'FAILED',
        error: result.reason?.message || 'Bilinmeyen Promise Hatası',
        savedRoomCount: 0,
        foundRoomCount: 0,
        durationMs: 0
      };
      allResults.push(errorResult);
      logger.error(`[${errorResult.index}/${totalLinkCountGlobal}] Görev Başarısız: ${errorResult.error}`);
    }
  });

  allResults.sort((a, b) => a.index - b.index);

  logger.info('Dosyaya yazma adımı atlandı, veriler veritabanına kaydedildi.');

  const successCount = allResults.filter(res => res.status === 'SUCCESS').length;
  const totalErrors = allResults.length - successCount;
  const overallEndTime = Date.now();
  const overallDurationMinutes = Math.round((overallEndTime - overallStartTime) / 60000 * 10) / 10;

  logger.info('================================================');
  logger.info(`Piscina Room Scraper (App ${appIndex}/${totalApps}) İşlem Özeti:`);
  logger.info('================================================');
  logger.info(`İşlenen Link (Bu App): ${allResults.length}`);
  logger.info(`Başarıyla İşlenen (Scraping - Bu App): ${successCount}`);
  logger.info(`Hatalı/Atlanan (Scraping - Bu App): ${totalErrors}`);
  logger.info(`Bulunan Oda (Bu App): ${totalRoomsFound}`);
  logger.info(`Kaydedilen Oda (Bu App): ${totalRoomsSaved}`);
  logger.info(`Süre (Bu App): ${overallDurationMinutes} dakika`);
  logger.info('================================================');

  try {
    await prisma.$connect();
    logger.info('Prisma client connected.');

    // --- Dosyaya yazma mantığı zaten kaldırılmıştı ---
    logger.info('Dosyaya yazma adımı atlandı, veriler veritabanına kaydedildi.');

    // --- Özet (Bu app instance'ı için) ---
    const successCount = allResults.filter(res => res.status === 'SUCCESS').length;
    const totalErrors = allResults.length - successCount;
    const overallEndTime = Date.now();
    const overallDurationMinutes = Math.round((overallEndTime - overallStartTime) / 60000 * 10) / 10;

    logger.info('================================================');
    logger.info(`Piscina Room Scraper (App ${appIndex}/${totalApps}) İşlem Özeti:`);
    logger.info('================================================');
    logger.info(`İşlenen Link (Bu App): ${allResults.length}`);
    logger.info(`Başarıyla İşlenen (Scraping - Bu App): ${successCount}`);
    logger.info(`Hatalı/Atlanan (Scraping - Bu App): ${totalErrors}`);
    logger.info(`Bulunan Oda (Bu App): ${totalRoomsFound}`);
    logger.info(`Kaydedilen Oda (Bu App): ${totalRoomsSaved}`);
    logger.info(`Süre (Bu App): ${overallDurationMinutes} dakika`);
    logger.info('================================================');

  } catch (error) {
    logger.error(`Ana scraper sürecinde hata oluştu (App ${appIndex}): ${error.message}`, { stack: error.stack });
  } finally {
    await prisma.$disconnect().catch(e => logger.error(`Prisma disconnect hatası (App ${appIndex}): ${e.message}`));
    logger.info(`Prisma client disconnected (App ${appIndex}).`);
    logger.info(`Scraper işlemi sona erdi (App ${appIndex}).`);
  }
}

runScraper().catch(err => {
  logger.error(`Beklenmedik genel hata (App ${appIndex}): ${err.message}`);
  process.exit(1);
});

// SIGINT/SIGTERM handlers remain the same

process.on('SIGINT', async () => {
  logger.info(`Uygulama kapatılıyor (SIGINT - App ${appIndex})...`);
  await prisma.$disconnect().catch(e => logger.error(`Prisma disconnect hatası (SIGINT - App ${appIndex}): ${e.message}`));
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info(`Uygulama kapatılıyor (SIGTERM - App ${appIndex})...`);
  await prisma.$disconnect().catch(e => logger.error(`Prisma disconnect hatası (SIGTERM - App ${appIndex}): ${e.message}`));
  process.exit(0);
});