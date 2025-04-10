// worker.js - Piscina worker thread for scraping hotel room details (Local File Output - Simplified)
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const { URL } = require('url');
// PrismaClient kaldırıldı

// Basit konsol loglama
const logger = {
  info: (msg) => console.log(`[Worker ${process.pid}] INFO: ${msg}`),
  warn: (msg) => console.warn(`[Worker ${process.pid}] WARN: ${msg}`),
  error: (msg, meta) => console.error(`[Worker ${process.pid}] ERROR: ${msg}`, meta || ''),
};

// --- Helper Fonksiyonlar ---

function cleanPrice(priceText) {
  try {
    // Fiyat metnindeki para birimi simgesi, binlik ayırıcı gibi fazlalıkları temizle
    // Sadece rakamları ve ondalık ayırıcıyı (nokta veya virgül) bırak, sonra virgülü noktaya çevir
    const cleaned = priceText.replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(cleaned);
  } catch (error) {
    logger.warn(`Fiyat temizlenemedi: "${priceText}" - Hata: ${error.message}`);
    return null; // Hata durumunda null döndür
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
    if (!roomTable) {
        logger.error('Oda tablosu bulunamadı');
        return { rooms: [] }; // Sadece boş oda listesi döndür
    }

    let rows = await driver.findElements(By.css('#hprt-table > tbody > tr'));
    logger.info(`${rows.length} oda satırı bulundu (tbody > tr)`);

    // --- Oda ID'sine göre satırları tekilleştirme ---
    const distinctRows = [];
    const seenRoomIds = new Set();
    for (const row of rows) {
        try {
            // data-block-id'yi veya select id'sinden room id'yi bulmaya çalış
            let roomId = null;
            const dataBlockId = await row.getAttribute('data-block-id').catch(() => null);
            if (dataBlockId) {
                roomId = dataBlockId.split('_')[0];
            } else {
                // Alternatif: Satır içindeki select elementinden ID almayı dene
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
                // ID bulunamayan satırları da şimdilik ekleyelim, belki farklı bir yapı
                distinctRows.push(row);
                logger.warn('Satır için Room ID (data-block-id veya select id) bulunamadı.');
            }
        } catch (e) {
            logger.warn(`Satırın Room ID özniteliği okunurken/bulunurken hata: ${e.message}. Satır korunuyor.`);
            distinctRows.push(row);
        }
    }
    logger.info(`Tekilleştirme sonrası ${distinctRows.length} satır kaldı.`);
    rows = distinctRows; // rows değişkenini tekilleştirilmiş liste ile güncelle
    // --- Tekilleştirme Sonu ---

    const scrapedRooms = []; // Scrape edilen oda bilgilerini tutacak dizi

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowIndex = i + 1; // Loglama için
        try {
            let roomName = 'Standart Oda';
            let roomsLeft = 0;
            let price = null;

            // Oda Adı
            try {
                const nameElement = await row.findElement(By.css('.hprt-roomtype-icon-link')).catch(() => null);
                if (nameElement) roomName = await nameElement.getText();
            } catch (e) { logger.warn(`Satır ${rowIndex}: Oda adı alınamadı.`); }

            // Oda Sayısı (Select)
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

            // Fiyat
            try {
                const priceElement = await row.findElement(By.css('.prco-valign-middle-helper')).catch(() => null);
                if (priceElement) price = cleanPrice(await priceElement.getText());
            } catch (e) { logger.warn(`Satır ${rowIndex}: Fiyat alınamadı.`); }

            // Sadece geçerli verisi olan odaları ekle (en azından isim ve sayı)
            if (roomName && roomsLeft > 0) {
                 scrapedRooms.push({
                    roomName: roomName.trim(),
                    roomsLeft: roomsLeft,
                    price: price
                 });
            } else {
                 logger.warn(`Satır ${rowIndex}: Yetersiz bilgi (Oda Adı: ${roomName}, Sayı: ${roomsLeft}), oda listeye eklenmedi.`);
            }

        } catch (error) {
            logger.error(`Satır ${rowIndex} işlenirken genel hata: ${error.message}`);
        }
    }

    logger.info(`Toplam ${scrapedRooms.length} benzersiz oda bilgisi toplandı.`);
    // Sadece oda listesini döndür
    return { rooms: scrapedRooms };

  } catch (error) {
    logger.error(`Oda bilgileri toplanırken genel hata: ${error.message}`);
    return { rooms: [] }; // Hata durumunda boş liste döndür
  }
}

function getCheckinDateFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        const checkin = url.searchParams.get('checkin');
        if (checkin && /^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
            const date = new Date(checkin + 'T00:00:00Z');
            if (!isNaN(date.getTime())) return date;
        }
    } catch (e) { logger.warn(`URL'den checkin tarihi alınamadı: ${urlString}`); }
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

// --- Worker Ana Fonksiyonu ---
module.exports = async ({ url, index, totalCount, env }) => {
  const TIMEOUT = parseInt(env.TIMEOUT || '120000'); // Timeout ana script'ten geliyor (120sn)
  const DISABLE_IMAGES = env.DISABLE_IMAGES === 'true';
  const USER_AGENT = env.USER_AGENT;

  let driver = null;
  const cleanUrl = url.trim();
  const startTime = Date.now();
  let roomResults = { rooms: [] }; // Varsayılan boş liste
  let status = 'FAILED';
  let errorMessage = null;

  try {
    logger.info(`[${index}/${totalCount}] İşleniyor: ${cleanUrl}`);
    const checkinDate = getCheckinDateFromUrl(cleanUrl);
    logger.info(`Check-in tarihi: ${checkinDate.toISOString().split('T')[0]}`);

    // Selenium WebDriver'ı başlat
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--headless=new');
    chromeOptions.addArguments('--disable-gpu');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.addArguments('--window-size=1920,1080');
    if (DISABLE_IMAGES) chromeOptions.addArguments('--blink-settings=imagesEnabled=false');
    if (USER_AGENT) chromeOptions.addArguments(`--user-agent=${USER_AGENT}`);

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    await driver.manage().setTimeouts({
      implicit: TIMEOUT / 6,
      pageLoad: TIMEOUT,
      script: TIMEOUT / 2
    });

    await driver.get(cleanUrl);
    logger.info('Otel sayfasına gidildi');

    // Doğrudan oda detaylarını çek
    roomResults = await scrapeRoomDetails(driver);

    // Oda bulunduysa başarılı say
    if (roomResults.rooms && roomResults.rooms.length >= 0) { // Oda olmasa bile tablo bulunduysa başarılı olabilir
         status = 'SUCCESS';
         if(roomResults.rooms.length === 0) {
             logger.info('Oda tablosu bulundu ancak işlenecek oda verisi yok veya alınamadı.');
         }
    } else {
        errorMessage = 'Oda detayları alınamadı veya işlenemedi.';
        status = 'FAILED';
    }

  } catch (error) {
    logger.error(`Worker hatası (${cleanUrl}): ${error.message}`, { stack: error.stack });
    errorMessage = error.message;
    status = 'FAILED';
  } finally {
    if (driver) {
      await driver.quit().catch(e => logger.error(`Driver kapatılırken hata: ${e.message}`));
    }
  }

  const endTime = Date.now();
  // Sonucu ana sürece döndür (sadeleştirilmiş)
  return {
    index: index,
    url: cleanUrl,
    status: status,
    rooms: roomResults.rooms, // Sadece oda listesi
    error: errorMessage,
    durationMs: endTime - startTime
  };
};