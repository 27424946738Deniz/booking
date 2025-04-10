require('dotenv').config();
const path = require('path');
const Piscina = require('piscina');
const os = require('os');
const fs = require('fs').promises;
const logger = require('./src/utils/logger');
const { readHotelLinks } = require('./src/room-scraper/scraper/roomScraper'); // readHotelLinks'i hala kullanabiliriz

// --- Ayarlar ---
const inputFile = path.resolve(__dirname, 'extracted_hotel_links_09-10_may.txt');
const outputFile = path.resolve(__dirname, `local_room_results_${path.basename(inputFile, '.txt')}.txt`);
const numWorkers = Math.max(1, os.cpus().length - 1); // Dinamik hesaplama tekrar aktif edildi
// const numWorkers = 4; // Sabit değer yorum satırı yapıldı
const separator = '=================================================='; // Ayırıcı

logger.info(`Room scraper başlatılıyor (Piscina - Yerel Dosya - Sadeleştirilmiş)...`);
logger.info(`Kullanılacak link dosyası: ${inputFile}`);
logger.info(`Çıktı dosyası: ${outputFile}`);
logger.info(`Worker sayısı: ${numWorkers}`); // Dinamik olarak hesaplanan sayıyı loglayacak

const piscina = new Piscina({
  filename: path.resolve(__dirname, 'src/room-scraper/worker.js'),
  minThreads: numWorkers,
  maxThreads: numWorkers,
});

async function runScraper() {
  const overallStartTime = Date.now();
  const allResults = [];

  try {
    const hotelLinks = await readHotelLinks(inputFile);
    if (!hotelLinks || hotelLinks.length === 0) {
        logger.error('Link dosyasında işlenecek URL bulunamadı.');
        return;
    }
    const totalLinks = hotelLinks.length;
    logger.info(`${totalLinks} otel linki işlenecek.`);

    const tasks = hotelLinks.map((url, index) => {
      const workerData = {
        url: url,
        index: index + 1,
        totalCount: totalLinks,
        env: {
            TIMEOUT: process.env.TIMEOUT || '120000', // Varsayılan 120sn
            DISABLE_IMAGES: process.env.DISABLE_IMAGES,
            USER_AGENT: process.env.USER_AGENT
        }
      };
      return piscina.run(workerData)
               .catch(error => {
                   logger.error(`Worker görevi hatası (${url}): ${error.message}`, { stack: error.stack });
                   return { index: index + 1, url: url, status: 'FAILED', error: error.message };
               });
    });

    logger.info('Tüm görevler worker havuzuna gönderildi, sonuçlar bekleniyor...');
    const settledResults = await Promise.allSettled(tasks);
    logger.info('Tüm görevler tamamlandı.');

    settledResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            allResults.push(result.value);
        } else {
            const errorResult = result.reason || { index: i + 1, url: hotelLinks[i], status: 'FAILED', error: 'Bilinmeyen Promise Hatası' };
             if (!errorResult.index) {
                errorResult.index = i + 1;
                errorResult.url = hotelLinks[i];
                errorResult.status = 'FAILED';
             }
            allResults.push(errorResult);
            logger.error(`[${errorResult.index}/${totalLinks}] Görev Başarısız: ${errorResult.error}`);
        }
    });

    // Sonuçları index'e göre sırala
    allResults.sort((a, b) => a.index - b.index);

    // Sonuçları dosyaya yaz
    logger.info(`Sonuçlar ${outputFile} dosyasına yazılıyor...`);
    let outputContent = '';
    let successCount = 0;
    for (const res of allResults) {
        outputContent += `INDEX: ${res.index}\n`;
        outputContent += `URL: ${res.url}\n`;
        outputContent += `STATUS: ${res.status}\n`;
        if (res.status === 'SUCCESS') {
            successCount++;
            outputContent += `ROOMS_DATA: ${JSON.stringify(res.rooms)}\n`;
        } else {
            outputContent += `ERROR: ${res.error || 'Bilinmeyen Hata'}\n`;
        }
        outputContent += `${separator}\n`;
    }

    await fs.writeFile(outputFile, outputContent, 'utf8');
    logger.info(`Sonuçlar başarıyla ${outputFile} dosyasına yazıldı.`);


    // --- Özetleme ---
    const totalErrors = allResults.length - successCount;
    const overallEndTime = Date.now();
    const overallDurationMinutes = Math.round((overallEndTime - overallStartTime) / 60000 * 10) / 10;

    logger.info('================================================');
    logger.info('Piscina Room Scraper (Yerel Dosya - Sadeleştirilmiş) İşlem Özeti:');
    logger.info('================================================');
    logger.info(`Toplam İşlenen Link: ${allResults.length}`);
    logger.info(`Başarıyla İşlenen: ${successCount}`);
    logger.info(`Hatalı/Atlanan: ${totalErrors}`);
    logger.info(`Toplam Süre: ${overallDurationMinutes} dakika`);
    logger.info(`Çıktı Dosyası: ${outputFile}`);
    logger.info('================================================');


  } catch (error) {
    logger.error(`Ana scraper sürecinde hata oluştu: ${error.message}`, { stack: error.stack });
  } finally {
    logger.info('Scraper işlemi sona erdi.');
  }
}

runScraper().catch(err => {
  logger.error(`Beklenmedik genel hata: ${err.message}`);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Uygulama kapatılıyor (SIGINT)...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Uygulama kapatılıyor (SIGTERM)...');
  process.exit(0);
});