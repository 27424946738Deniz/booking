// worker.js - Piscina worker thread for scraping hotel room details (Database Output - Refined Logic)
const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { URL } = require('url');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger.js'); // Ensure logger is required

const logger = {
  info: (msg) => console.log(`[Worker ${process.pid}] INFO: ${msg}`),
  warn: (msg) => console.warn(`[Worker ${process.pid}] WARN: ${msg}`),
  error: (msg, meta) => console.error(`[Worker ${process.pid}] ERROR: ${msg}`, meta || ''),
};

// --- Helper Fonksiyonlar ---

function cleanPrice(priceText) {
  try {
    const cleaned = priceText.replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(cleaned);
  } catch (error) {
    logger.warn(`Fiyat temizlenemedi: "${priceText}" - Hata: ${error.message}`);
    return null;
  }
}

async function scrapeRoomDetails(driver) {
  try {
    logger.info('Oda bilgileri toplanıyor...');
    const tableSelectors = ['#hprt-table', '.hprt-table', '.roomstable', '.roomsList'];
    let roomTable = null;
    for (const selector of tableSelectors) {
      try {
        roomTable = await driver.findElement(By.css(selector));
        logger.info(`Oda tablosu bulundu: ${selector}`);
        break;
      } catch (err) { /* sonraki */ }
    }
    if (!roomTable) {
         logger.warn('Oda tablosu bulunamadı, alternatif selektörler deneniyor...');
         const allTables = await driver.findElements(By.css('table'));
         if (allTables.length > 0) {
             for (const table of allTables) {
                 try {
                     const classAttribute = await table.getAttribute('class');
                     if (classAttribute && (classAttribute.includes('room') || classAttribute.includes('hprt'))) {
                         roomTable = table;
                         logger.info(`Oda tablosu bulundu: .${classAttribute}`);
                         break;
                     }
                 } catch (err) { continue; }
             }
         }
    }

    // Tablo bulunduysa odaları işle
    if (roomTable) {
        let rows = await driver.findElements(By.css('#hprt-table > tbody > tr'));
        logger.info(`${rows.length} oda satırı bulundu (tbody > tr)`);

        // --- Oda ID'sine göre satırları tekilleştirme ---
        const distinctRows = [];
        const seenRoomIds = new Set();
        for (const row of rows) {
            try {
                let roomId = null;
                const dataBlockId = await row.getAttribute('data-block-id').catch(() => null);
                if (dataBlockId) {
                    roomId = dataBlockId.split('_')[0];
                } else {
                     const selectElement = await row.findElement(By.css('select[id^="hprt_nos_select_"]')).catch(() => null);
                     if (selectElement) {
                         const selectId = await selectElement.getAttribute('id');
                         const roomIdMatch = selectId.match(/hprt_nos_select_(\d+)_/);
                         if (roomIdMatch) {
                             roomId = roomIdMatch[1];
                         }
                     }
                }

                if (roomId && !seenRoomIds.has(roomId)) {
                    seenRoomIds.add(roomId);
                    distinctRows.push(row);
                } else if (!roomId) {
                    distinctRows.push(row);
                    logger.warn('Satır için Room ID (data-block-id veya select id) bulunamadı.');
                }
            } catch (e) {
                logger.warn(`Satırın Room ID özniteliği okunurken/bulunurken hata: ${e.message}. Satır korunuyor.`);
                distinctRows.push(row);
            }
        }
        logger.info(`Tekilleştirme sonrası ${distinctRows.length} satır kaldı.`);
        rows = distinctRows;
        // --- Tekilleştirme Sonu ---

        const scrapedRooms = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIndex = i + 1;
            try {
                let roomName = 'Standart Oda';
                let roomsLeft = 0;
                let price = null;

                try {
                    const nameElement = await row.findElement(By.css('.hprt-roomtype-icon-link')).catch(() => null);
                    if (nameElement) roomName = await nameElement.getText();
                } catch (e) { logger.warn(`Satır ${rowIndex}: Oda adı alınamadı.`); }

                try {
                    const selectElement = await row.findElement(By.css('select[id^="hprt_nos_select_"]')).catch(() => null);
                    if (selectElement) {
                        const options = await selectElement.findElements(By.css('option'));
                        if (options.length > 0) {
                             const maxOption = options[options.length - 1];
                             roomsLeft = parseInt(await maxOption.getAttribute('value'), 10);
                             if (isNaN(roomsLeft)) roomsLeft = 0;
                        }
                    }
                } catch (e) { logger.warn(`Satır ${rowIndex}: Oda sayısı (select) alınamadı.`); }

                try {
                    const priceElement = await row.findElement(By.css('.prco-valign-middle-helper')).catch(() => null);
                    if (priceElement) price = cleanPrice(await priceElement.getText());
                } catch (e) { logger.warn(`Satır ${rowIndex}: Fiyat alınamadı.`); }

                // Oda adı varsa ve oda sayısı 0 veya daha fazlaysa ekle (0'ları da dahil et)
                if (roomName) {
                     scrapedRooms.push({
                        roomName: roomName.trim(),
                        roomsLeft: roomsLeft,
                        price: price
                     });
                } else {
                     logger.warn(`Satır ${rowIndex}: Oda Adı bulunamadı, oda listeye eklenmedi.`);
                }

            } catch (error) {
                logger.error(`Satır ${rowIndex} işlenirken genel hata: ${error.message}`);
            }
        }
        logger.info(`Toplam ${scrapedRooms.length} benzersiz oda bilgisi toplandı.`);
        return { status: 'FOUND', rooms: scrapedRooms }; // Başarılı scrape durumu
    } else {
        // Oda tablosu bulunamadı, müsaitlik yok mesajını kontrol et
        try {
            await driver.findElement(By.css('#no_availability_msg'));
            logger.info('Oda tablosu bulunamadı ama "müsaitlik yok" mesajı bulundu.');
            return { status: 'NO_AVAILABILITY', rooms: [] }; // Özel durum kodu döndür
        } catch (e) {
            // Ne tablo ne de mesaj bulundu
            logger.error('Oda tablosu ve "müsaitlik yok" mesajı bulunamadı.');
            return { status: 'TABLE_NOT_FOUND', rooms: [] }; // Özel durum kodu döndür
        }
    }
  } catch (error) {
    logger.error(`Oda bilgileri toplanırken genel hata: ${error.message}`);
    return { status: 'ERROR', rooms: [], error: error.message }; // Hata durumu
  }
}

function getCheckinDateFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        const checkin = url.searchParams.get('checkin');
        if (checkin && /^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
            const date = new Date(checkin + 'T00:00:00Z'); // Ensure UTC
            if (!isNaN(date.getTime())) return date;
        }
    } catch (e) { logger.warn(`URL'den checkin tarihi alınamadı: ${urlString}`); }
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); // Return UTC date
}

// --- Worker Ana Fonksiyonu ---
module.exports = async (workerData) => {
  const { url, index, totalCount, env } = workerData;
  const { DATABASE_URL, TIMEOUT, DISABLE_IMAGES, USER_AGENT } = env;
  const timeoutMs = parseInt(TIMEOUT, 10) || 120000; // 120 saniye varsayılan

  const logPrefix = `[Worker ${process.pid}]`;
  logger.info(`${logPrefix} Worker using DATABASE_URL from workerData.env (Quotes trimmed): >${DATABASE_URL ? DATABASE_URL.substring(0, 10) + '...' + DATABASE_URL.substring(DATABASE_URL.length - 5) : 'NOT PROVIDED'}<`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  });

  let driver;
  const startTime = Date.now();
  const checkinDate = new Date();
  const checkoutDate = new Date();
  // Saat 21:00 kontrolü ve tarih ayarlama (run_room_scraper_specific.cjs ile aynı mantık)
  if (checkinDate.getHours() >= 21) {
    checkinDate.setDate(checkinDate.getDate() + 1);
  }
  checkoutDate.setDate(checkinDate.getDate() + 1);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const checkinDateStr = formatDate(checkinDate);
  // logger.info(`${logPrefix} Check-in tarihi: ${checkinDateStr}`); // This might be redundant if parent script logs it

  // Otel ID'sini hesapla (run_room_scraper_specific.cjs'deki mantıkla aynı)
  const targetHotelId = index + 11378; // booking-list.cjs'nin 0-index'li olduğunu varsayarak +1 ve offset
  logger.info(`${logPrefix} >>> [DEBUG] Received index: ${index}, Using calculated target Hotel ID: ${targetHotelId} (URL: ${url})`);

  try {
    await prisma.$connect(); // Worker başlangıcında bağlan

    // --- WebDriver Ayarları ---
    const options = new chrome.Options();
    options.addArguments(
      // '--headless', // Keep original headless for Chrome 90 compatibility - REMOVED
      '--headless=new', // Use new headless mode for updated Chrome
      '--no-sandbox', // Add no-sandbox
      '--disable-gpu', // Add disable-gpu
      '--disable-dev-shm-usage', // Add disable-dev-shm-usage
      '--window-size=1920,1080' // Add window-size
      // '--disable-extensions',
      // '--disable-infobars',
      // '--disable-popup-blocking',
      // '--ignore-certificate-errors',
      // '--disable-logging', // Çıktıyı azaltmak için loglamayı kapatabiliriz
      // '--log-level=3', // Sadece ölümcül hataları göster
      // '--silent' // Sessiz mod
    );

    // Resimleri devre dışı bırakma ayarı
    if (DISABLE_IMAGES === 'true') {
      logger.info(`${logPrefix} Disabling images.`);
      options.setUserPreferences({ 'profile.managed_default_content_settings.images': 2 });
    }

    // User-Agent ayarı
    if (USER_AGENT) {
      logger.info(`${logPrefix} Setting User-Agent to: ${USER_AGENT}`);
      options.addArguments(`--user-agent=${USER_AGENT}`);
    } else {
       logger.info(`${logPrefix} Using default User-Agent.`);
    }
    // options.addArguments('--remote-debugging-port=9222'); // Hata ayıklama için gerekirse açılabilir

    logger.info(`${logPrefix} Letting ChromeDriver manage its own temporary profile.`);

    // --- WebDriver Oluşturma ---
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      // Gerekirse ChromeDriver yolunu belirtin:
      // .setChromeService(new chrome.ServiceBuilder('/path/to/chromedriver'))
      .build();
    logger.info(`${logPrefix} WebDriver built.`);

    // Sayfa yükleme zaman aşımı ve script zaman aşımı ayarları
    await driver.manage().setTimeouts({
      implicit: 0, // Örtük bekleme kullanma (Explicit Wait tercih edilir)
      pageLoad: timeoutMs, // Sayfa yükleme için timeout
      script: timeoutMs // Script çalıştırma için timeout
    });
    logger.info(`${logPrefix} Timeouts set (pageLoad/script): ${timeoutMs}ms`);

    // --- Sayfaya Gitme ---
    logger.info(`${logPrefix} [${index}/${totalCount}] İşleniyor: ${url}. Hotel ID (from index): ${index}`);
    await driver.get(url);
    logger.info(`${logPrefix} Otel sayfasına gidildi`);

    // Sayfanın tam olarak yüklenmesini beklemek için strateji (Örnek: Oda tablosu görünene kadar)
    // Body elementinin yüklenmesini bekleyelim (temel kontrol)
    await driver.wait(until.elementLocated(By.css('body')), timeoutMs);
    // Spesifik bir oda konteynerinin veya fiyatın görünmesini beklemek daha sağlam olabilir:
    // await driver.wait(until.elementLocated(By.css('.some-room-container-selector')), timeoutMs);
    // logger.info(`${logPrefix} Body element located, page likely loaded.`);

    // --- Oda Bilgilerini Çekme ---
    logger.info(`${logPrefix} Oda bilgileri toplanıyor...`);

    // Oda bloklarını bul (Selector'ı kontrol et) - Bu selector sayfaya göre değişebilir!
    // Örnek: '.hprt-block', '.room-block', 'div[data-testid="room-block"]'
    const roomBlocksSelector = By.css('div.hprt-table tbody tr'); // Bu sık kullanılan bir yapıdır, ama doğrula.
    await driver.wait(until.elementLocated(roomBlocksSelector), timeoutMs / 2); // Timeout'un yarısı kadar bekle
    const roomBlocks = await driver.findElements(roomBlocksSelector);
    logger.info(`${logPrefix} ${roomBlocks.length} potansiyel oda bloğu bulundu.`);

    if (roomBlocks.length === 0) {
      logger.warn(`${logPrefix} Oda bloğu bulunamadı. Sayfa yapısı değişmiş olabilir veya oda yok. URL: ${url}`);
      await driver.quit();
      await prisma.$disconnect();
      return { index, url, status: 'SUCCESS_NO_ROOMS', foundRoomCount: 0, savedRoomCount: 0, durationMs: Date.now() - startTime };
    }

    const roomsData = [];
    let roomsFoundInPage = 0;

    for (const roomBlock of roomBlocks) {
      try {
        roomsFoundInPage++;
        // Oda Adı (Selector'ı kontrol et)
        const roomNameElement = await roomBlock.findElement(By.css('.hprt-roomtype-cell .hprt-roomtype-name')); // veya 'span[data-testid="room-name"]'
        const roomName = await roomNameElement.getText();

        // Fiyat (Selector'ı kontrol et)
        const priceElement = await roomBlock.findElement(By.css('.bui-price-display__value')); // veya 'span[data-testid="price-and-discounted-price"]'
        let priceText = await priceElement.getText();
        priceText = priceText.replace(/[^\d.,]/g, '').replace(',', '.'); // Para birimi simgesi, TL vb. temizle, virgülü noktaya çevir
        const price = parseFloat(priceText);

        // Müsaitlik (Selector'ı kontrol et - Bazen sadece buton olur)
        let availability = 'Available'; // Varsayılan
        try {
          // Örneğin "1 oda kaldı" gibi bir metin varsa veya "Seç" butonu aktifse
          const availabilityElement = await roomBlock.findElement(By.css('.hprt-nos-select')); // Veya '.room--remaining' vb.
          // Bazen müsaitlik durumu select dropdown içindeki option sayısıyla belirtilir.
          const options = await availabilityElement.findElements(By.css('option'));
          if (options.length <= 1 && (await options[0].getAttribute('value')) === '0') { // Eğer sadece "0" seçeneği varsa veya hiç option yoksa (selector'a göre değişir)
            availability = 'Sold Out';
          }
        } catch (e) {
          if (e.name === 'NoSuchElementError') {
            // Element yoksa farklı bir yapı olabilir, belki de her zaman müsait? Veya farklı bir selector.
            // Veya "Rezerve edildi" gibi bir yazı olabilir.
             try {
                await roomBlock.findElement(By.css('.soldout_property')); // Satıldı işareti var mı?
                availability = 'Sold Out';
             } catch (soldoutError) {
                 // Satıldı işareti de yoksa, muhtemelen müsait kabul edebiliriz veya loglayabiliriz.
                 logger.warn(`${logPrefix} Müsaitlik durumu net tespit edilemedi for room "${roomName}". Assuming Available. URL: ${url}`);
             }
          } else {
            throw e; // Başka bir hata ise fırlat
          }
        }

        if (roomName && !isNaN(price)) {
          roomsData.push({
            roomName: roomName.trim(),
            price: price,
            availability: availability.trim(),
            checkinDate: checkinDateStr,
            hotelId: targetHotelId // Hesaplanan hotelId'yi kullan
          });
          logger.info(`${logPrefix} Oda bulundu: "${roomName.trim()}", Fiyat: ${price}, Durum: ${availability.trim()}`);
        } else {
          logger.warn(`${logPrefix} Geçersiz oda verisi atlandı: Ad='${roomName}', Fiyat='${priceText}' URL: ${url}`);
        }

      } catch (e) {
        if (e.name === 'NoSuchElementError') {
          logger.warn(`${logPrefix} Oda detayı (isim, fiyat veya müsaitlik) bulunamadı. Bu oda bloğu atlanıyor. URL: ${url}`);
        } else {
          logger.error(`${logPrefix} Oda bloğu işlenirken hata: ${e.message} URL: ${url}`);
        }
        // Bu odanın işlenmesine devam etme, sonraki bloğa geç
        continue;
      }
    }

    // --- Veritabanına Kaydetme ---
    let savedCount = 0;
    if (roomsData.length > 0) {
      logger.info(`${logPrefix} ${roomsData.length} geçerli oda verisi bulundu. Veritabanına kaydediliyor...`);
      try {
        const createPromises = roomsData.map(room =>
          prisma.availability.create({
            data: {
              hotelId: room.hotelId,
              roomName: room.roomName,
              price: room.price,
              checkinDate: new Date(room.checkinDate), // Tarihi Date objesine çevir
              availability: room.availability,
              scrapedAt: new Date()
            },
          }).catch(dbError => {
            // Olası unique constraint hatası gibi durumları logla ama süreci durdurma
            logger.error(`${logPrefix} Oda kaydetme hatası (HotelID: ${room.hotelId}, Oda: ${room.roomName}, Tarih: ${room.checkinDate}): ${dbError.message}`);
            return null; // Başarısız olanı null olarak işaretle
          })
        );

        const results = await Promise.all(createPromises);
        savedCount = results.filter(r => r !== null).length; // Başarıyla kaydedilenleri say
        logger.info(`${logPrefix} ${savedCount} / ${roomsData.length} oda verisi veritabanına kaydedildi (Hotel ID: ${targetHotelId}).`);

      } catch (error) {
        logger.error(`${logPrefix} Toplu oda kaydetme sırasında genel veritabanı hatası (Hotel ID: ${targetHotelId}): ${error.message}`);
        // Bu durumda savedCount 0 kalacak
      }
    } else {
      logger.info(`${logPrefix} Kaydedilecek geçerli oda verisi bulunamadı (Hotel ID: ${targetHotelId}).`);
    }

    // --- Temizlik ve Sonuç ---
    await driver.quit();
    logger.info(`${logPrefix} WebDriver kapatıldı.`);
    await prisma.$disconnect(); // İşlem bitince bağlantıyı kes
    const durationMs = Date.now() - startTime;
    logger.info(`${logPrefix} [${index}/${totalCount}] Tamamlandı. Süre: ${durationMs}ms. Bulunan: ${roomsFoundInPage}, Kaydedilen: ${savedCount}. URL: ${url}`);
    return { index, url, status: 'SUCCESS', foundRoomCount: roomsFoundInPage, savedRoomCount: savedCount, durationMs };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(`${logPrefix} Genel Worker hatası (${url}) (Index: ${index}): ${error.message}`, { stack: error.stack?.substring(0, 500) }); // Stack trace'i kısaltarak logla
    if (driver) {
      try {
        await driver.quit();
        logger.info(`${logPrefix} Hata sonrası WebDriver kapatıldı.`);
      } catch (quitError) {
        logger.error(`${logPrefix} Hata sonrası WebDriver kapatılırken ek hata: ${quitError.message}`);
      }
    }
    await prisma.$disconnect().catch(e => logger.error(`${logPrefix} Hata sonrası Prisma disconnect hatası: ${e.message}`)); // Hata durumunda da disconnect dene
    return { index, url, status: 'FAILED', error: error.message, foundRoomCount: 0, savedRoomCount: 0, durationMs };
  }
};