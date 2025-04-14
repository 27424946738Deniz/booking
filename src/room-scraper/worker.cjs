// worker.js - Piscina worker thread for scraping hotel room details (Database Output - Refined Logic)
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const { URL } = require('url');
const { PrismaClient } = require('@prisma/client');
const os = require('os');
const fs = require('fs').promises;

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
module.exports = async ({ url, index, totalCount, env }) => {
  // Timeout, Disable Images ve User Agent'i tekrar env objesinden al
  const TIMEOUT = parseInt(env.TIMEOUT || '120000');
  const DISABLE_IMAGES = env.DISABLE_IMAGES === 'true';
  const USER_AGENT = env.USER_AGENT;

  // --- ÖNERİLEN ÇÖZÜM --- 
  // Worker işleminin kendi ortam değişkenini ayarla
  // --- DATABASE_URL Handling ---
  // Ensure DATABASE_URL from workerData.env is set for the worker process
  // Rely on the DATABASE_URL provided by Azure App Service config (which should include sslmode=require)
  if (env.DATABASE_URL) {
    const cleanedUrl = env.DATABASE_URL.trim().replace(/^"|"$/g, ''); // Clean quotes just in case
    process.env.DATABASE_URL = cleanedUrl;
    logger.info(`Worker using DATABASE_URL from workerData.env (Quotes trimmed): >${process.env.DATABASE_URL}<`);
    if (cleanedUrl !== env.DATABASE_URL) {
       logger.warn('Original DATABASE_URL from workerData.env contained quotes!');
    }
  } else {
    logger.error('CRITICAL: Worker did not receive DATABASE_URL in workerData.env! Cannot connect to DB.');
    // Optional: throw an error here if DB connection is absolutely required to proceed
    // throw new Error('DATABASE_URL not provided to worker');
  }
  // ---

  // PrismaClient'ı başlatırken override'a gerek yok, process.env ayarlandı
  const prisma = new PrismaClient();

  let driver = null;
  const cleanUrl = url.trim();
  const startTime = Date.now();
  let status = 'FAILED';
  let errorMessage = null;
  let savedRoomCount = 0;
  let foundRoomCount = 0;

  try {
    // Bağlantı denemeden önce log
    logger.info(`Worker attempting connection. DATABASE_URL: >${process.env.DATABASE_URL}<`);
    logger.info(`Prisma Client Options (Internal): ${JSON.stringify(prisma._engineConfig?.datamodel?.datasources[0]?.url)}`); // Log internal URL if available
    await prisma.$connect();
    logger.info(`[${index}/${totalCount}] İşleniyor: ${cleanUrl}. Hotel ID (from index): ${index}`);
    const checkinDate = getCheckinDateFromUrl(cleanUrl);
    const checkinDateString = checkinDate.toISOString().split('T')[0];
    logger.info(`Check-in tarihi: ${checkinDateString}`);

    const targetHotelId = index; // Use index directly as hotelId

    // Initialize Chrome and scrape data
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--headless=new');
    chromeOptions.addArguments('--disable-gpu');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.addArguments('--window-size=1920,1080');

    // --user-data-dir kaldırıldı, ChromeDriver'ın kendi profilini yönetmesine izin veriliyor
    logger.info('Letting ChromeDriver manage its own temporary profile.');
    let userDataDir = null; // Ensure variable is declared for finally block, but set to null

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

    const scrapeResult = await scrapeRoomDetails(driver);
    foundRoomCount = scrapeResult.rooms.length;

    switch (scrapeResult.status) {
      case 'FOUND':
        status = 'SUCCESS';
        logger.info(`Scraping başarılı, ${foundRoomCount} oda bulundu. Veritabanına kaydediliyor...`);
        
        if (foundRoomCount > 0) {
          try {
            // Create availability record
            const availability = await prisma.availability.create({
              data: {
                hotelId: targetHotelId, // Use the index here
                scrapeDate: new Date(),
                minPrice: Math.min(...scrapeResult.rooms.map(r => r.price || Infinity).filter(p => p !== Infinity)) || null,
                totalAvailableRooms: scrapeResult.rooms.reduce((sum, room) => sum + (room.roomsLeft || 0), 0),
                currency: 'TRY',
                fetchSuccess: true,
                rooms: {
                  create: scrapeResult.rooms.map(room => ({
                    roomName: room.roomName,
                    roomsLeft: room.roomsLeft || 0,
                    price: room.price
                  }))
                }
              }
            });
            
            savedRoomCount = scrapeResult.rooms.length;
            logger.info(`Availability ve ${savedRoomCount} oda verisi (Hotel ID: ${targetHotelId}) başarıyla kaydedildi.`);
          } catch (dbError) {
            logger.error(`Veritabanı hatası (Hotel ID: ${targetHotelId}): ${dbError.message}`, { stack: dbError.stack });
            throw dbError;
          }
        } else {
          logger.info('Oda tablosu bulundu ancak işlenecek/kaydedilecek oda verisi yok.');
          // Create availability record with zero rooms
          await prisma.availability.create({
            data: {
              hotelId: targetHotelId, // Use index here
              scrapeDate: new Date(),
              totalAvailableRooms: 0,
              currency: 'TRY',
              fetchSuccess: true
            }
          });
        }
        break;

      case 'NO_AVAILABILITY':
        status = 'SUCCESS';
        logger.info('Otelde belirtilen tarihler için müsait oda bulunamadı.');
        // Create availability record with zero rooms
        await prisma.availability.create({
          data: {
            hotelId: targetHotelId, // Use index here
            scrapeDate: new Date(),
            totalAvailableRooms: 0,
            currency: 'TRY',
            fetchSuccess: true
          }
        });
        break;

      case 'TABLE_NOT_FOUND':
        status = 'FAILED';
        errorMessage = 'Oda tablosu veya müsaitlik yok mesajı bulunamadı.';
        logger.error(errorMessage + ` Hotel ID: ${targetHotelId}`);
        // Create availability record to mark the failed attempt
        await prisma.availability.create({
          data: {
            hotelId: targetHotelId, // Use index here
            scrapeDate: new Date(),
            totalAvailableRooms: 0,
            currency: 'TRY',
            fetchSuccess: false
          }
        });
        break;

      default:
        status = 'FAILED';
        errorMessage = scrapeResult.error || 'scrapeRoomDetails içinde bilinmeyen hata.';
        logger.error(`scrapeRoomDetails hatası: ${errorMessage}`);
        // Create availability record to mark the error
        await prisma.availability.create({
          data: {
            hotelId: targetHotelId, // Use index here
            scrapeDate: new Date(),
            totalAvailableRooms: 0,
            currency: 'TRY',
            fetchSuccess: false
          }
        });
        break;
    }

  } catch (error) {
    const logHotelId = typeof targetHotelId !== 'undefined' ? targetHotelId : index; // Use index if targetHotelId isn't set yet
    logger.error(`Genel Worker hatası (${cleanUrl}) (Hotel ID: ${logHotelId}): ${error.message}`, { stack: error.stack });
    errorMessage = error.message;
    status = 'FAILED';
  } finally {
    if (driver) {
      await driver.quit().catch(e => logger.error(`Driver kapatılırken hata: ${e.message}`));
    }
    // Geçici user data dizinini silme kaldırıldı (userDataDir is null)
    await prisma.$disconnect().catch(e => logger.error(`Prisma disconnect hatası: ${e.message}`));
  }

  const endTime = Date.now();
  return {
    index: index,
    url: cleanUrl,
    status: status,
    savedRoomCount: savedRoomCount,
    foundRoomCount: foundRoomCount,
    error: errorMessage,
    durationMs: endTime - startTime
  };
};