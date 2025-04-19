// test_specific_urls.js
require('dotenv').config();
const path = require('path');
const logger = require('./src/utils/logger.js'); // Ana logger'ı kullanalım
const piscina = require('piscina'); // Piscina'yı worker'ı çağırmak için değil, worker dosyasının path'ini almak için kullanabiliriz

// Hedef URL'ler ve bilinen 'yanlış' index'leri
const targets = [
  {
    index: 961,
    url: "https://www.booking.com/hotel/tr/golden-sail-old-city.tr.html?label=gen173nr-1BCAso5AFCFnNoZXJhdG9uLWlzdGFuYnVsLWNpdHlIM1gEaKkBiAEBmAEouAEYyAEM2AEB6AEBiAIBqAIEuAL0kdi_BsACAdICJDZhN2NmNzJkLWNmNDAtNDk0NS1iM2Y5LTA5NzI3MzZhNWY3NdgCBeACAQ&sid=e082a73bda0b0c5924a050a08177296b&aid=304142&ucfs=1&arphpl=1&checkin=2025-04-17&checkout=2025-04-18&dest_id=-755070&dest_type=city&group_adults=2&req_adults=2&no_rooms=1&group_children=0&req_children=0&hpos=15&hapos=263&sr_order=popularity&nflt=price%3DEUR-120-125-1&srpvid=6c453c29c8ac03e5&srepoch=1744187636&all_sr_blocks=668284506_273496366_2_41_0&highlighted_blocks=668284506_273496366_2_41_0&matching_block_id=668284506_273496366_2_41_0&sr_pri_blocks=668284506_273496366_2_41_0__12325&from=searchresults",
  },
  {
    index: 962,
    url: "https://www.booking.com/hotel/tr/walton-hotels-pera-amp-taksim-beyoglu.tr.html?label=gen173nr-1BCAso5AFCFnNoZXJhdG9uLWlzdGFuYnVsLWNpdHlIM1gEaKkBiAEBmAEouAEYyAEM2AEB6AEBiAIBqAIEuAL0kdi_BsACAdICJDZhN2NmNzJkLWNmNDAtNDk0NS1iM2Y5LTA5NzI3MzZhNWY3NdgCBeACAQ&sid=e082a73bda0b0c5924a050a08177296b&aid=304142&ucfs=1&arphpl=1&checkin=2025-04-17&checkout=2025-04-18&dest_id=-755070&dest_type=city&group_adults=2&req_adults=2&no_rooms=1&group_children=0&req_children=0&hpos=11&hapos=259&sr_order=popularity&nflt=price%3DEUR-120-125-1&srpvid=6c453c29c8ac03e5&srepoch=1744187636&all_sr_blocks=282148204_107962174_0_0_0_809408&highlighted_blocks=282148204_107962174_0_0_0_809408&matching_block_id=282148204_107962174_0_0_0_809408&sr_pri_blocks=282148204_107962174_0_0_0_809408_12500&from=searchresults",
  },
];

const workerPath = path.resolve(__dirname, 'src/scraper/worker.cjs');

// Worker'ı doğrudan çağırmak için fonksiyonu require et
const runWorkerTask = require(workerPath);

async function runTest() {
  logger.info('--- Spesifik URL Testi Başlatılıyor ---');
  const totalCount = targets.length; // Toplam işlem sayısı

  // Ortam değişkenlerini worker'a geçmek için hazırla
  const workerEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    TIMEOUT: process.env.TIMEOUT || '120000',
    DISABLE_IMAGES: process.env.DISABLE_IMAGES,
    USER_AGENT: process.env.USER_AGENT
  };

  if (!workerEnv.DATABASE_URL) {
    logger.error('HATA: DATABASE_URL ortam değişkeni bulunamadı! Lütfen .env dosyasını kontrol edin veya komut satırında belirtin.');
    return;
  }

  for (const target of targets) {
    logger.info(`--- ${target.index} Nolu Index/URL İşleniyor ---`);
    try {
      const result = await runWorkerTask({
        url: target.url,
        index: target.index, // Orijinal (yanlış) index'i gönderiyoruz ki worker'daki -5 düzeltmesi test edilsin
        totalCount: 2391, // Gerçek toplam link sayısı (worker logları için)
        env: workerEnv
      });
      logger.info(`Sonuç (Index ${target.index}): ${JSON.stringify(result)}`);
    } catch (error) {
      logger.error(`Hata (Index ${target.index}): ${error.message}`, { stack: error.stack });
    }
    logger.info(`--- ${target.index} Nolu Index/URL Tamamlandı ---`);
  }

  logger.info('--- Spesifik URL Testi Bitti ---');
}

runTest(); 