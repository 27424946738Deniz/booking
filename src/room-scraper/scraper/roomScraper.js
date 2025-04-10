const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const logger = require('../utils/logger');
const fs = require('fs'); // Use synchronous existsSync
const fsp = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { URL } = require('url'); // URL parsing için

/**
 * Oda seçim elementinden maksimum oda sayısını al
 * @param {WebElement} selectElement - Oda seçim elementi
 * @returns {Promise<number>} Maksimum oda sayısı
 */
async function getMaxRoomsFromSelect(selectElement) {
  try {
    const options = await selectElement.findElements(By.css('option'));
    let maxRooms = 0;

    for (const option of options) {
      const value = await option.getAttribute('value');
      const numRooms = parseInt(value);
      if (!isNaN(numRooms) && numRooms > maxRooms) {
        maxRooms = numRooms;
      }
    }

    return maxRooms;
  } catch (error) {
    logger.warn(`Oda sayısı alınamadı: ${error.message}`);
    return 0;
  }
}

/**
 * Oda fiyatını temizle ve sayıya çevir
 * @param {string} priceText - Ham fiyat metni
 * @returns {number} Temizlenmiş fiyat
 */
function cleanPrice(priceText) {
  try {
    return parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
  } catch (error) {
    return 0;
  }
}

/**
 * Otel sayfasından oda bilgilerini topla
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @returns {Promise<Object>} Oda bilgileri
 */
async function scrapeRoomDetails(driver) {
  try {
    logger.info('Oda bilgileri toplanıyor...');
    logger.info('Oda tablosu aranıyor...');

    // Oda tablosunu bulma
    const tableSelectors = [
      '#hprt-table',
      '.hprt-table',
      '.roomstable',
      '.roomsList'
    ];

    let roomTable = null;
    for (const selector of tableSelectors) {
      try {
        roomTable = await driver.findElement(By.css(selector));
        logger.info(`Oda tablosu bulundu: ${selector}`);
        break;
      } catch (err) {
        // Bu seçici bulunamadı, diğerini dene
      }
    }

    if (!roomTable) {
      logger.warn('Oda tablosu bulunamadı, alternatif selektörler deneniyor...');
      // Alternatif yöntem: Sayfa genelinde tablo arama
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
          } catch (err) {
            continue;
          }
        }
      }
    }

    if (!roomTable) {
      logger.error('Oda tablosu bulunamadı');
      return {
        totalAvailableRooms: 0,
        uniqueRoomTypes: 0,
        minPrice: null,
        rooms: []
      };
    }

    // 1. Öncelikle tablodaki tüm satırları bulalım
    const rows = await driver.findElements(By.css('#hprt-table > tbody > tr'));
    logger.info(`${rows.length} oda satırı bulundu (tbody > tr)`);

    // Benzersiz selektör ID'lerini ve oda bilgilerini tutacak yapılar
    const processedSelectIds = new Set(); // Benzersiz select ID'lerini takip etmek için
    const uniqueRoomsByRoomId = new Map(); // Her bir oda ID'si için oda bilgilerini tutacak Map
    let totalAvailableRooms = 0; // Toplam müsait oda sayısı (her bir oda için maksimum değer toplamı)
    let minPrice = Infinity;

    // 2. Her satır için işlemleri gerçekleştirelim
    for (let i = 0; i < rows.length; i++) {
      try {
        const rowIndex = i + 1; // CSS nth-child 1-tabanlıdır
        logger.info(`Satır ${rowIndex} işleniyor...`);

        // a) Önce satırı bul
        const rowSelector = `#hprt-table > tbody > tr:nth-child(${rowIndex})`;

        // b) Satır içinde oda seçim hücresini bul
        const cellSelector = `${rowSelector} > td.hprt-table-cell.hprt-table-room-select`;
        const selectCell = await driver.findElement(By.css(cellSelector)).catch(() => null);

        if (!selectCell) {
          logger.warn(`Satır ${rowIndex}'de oda seçim hücresi bulunamadı, atlanıyor`);
          continue;
        }

        // c) Hücre içindeki select elementlerini bul
        const selects = await selectCell.findElements(By.css('select[id^="hprt_nos_select_"]'));

        if (selects.length === 0) {
          logger.warn(`Satır ${rowIndex}'de oda sayısı seçici bulunamadı, bir sonraki satıra geçiliyor`);
          continue;
        }

        // d) Her bir select elementi için işlem yap
        for (const select of selects) {
          try {
            // Select ID'sini al - bu benzersiz bir oda türünü temsil eder
            const selectId = await select.getAttribute('id');

            // Eğer bu select ID'si daha önce işlendiyse, atla
            if (processedSelectIds.has(selectId)) {
              logger.info(`Select ID: ${selectId} daha önce işlenmiş, atlıyoruz`);
              continue;
            }

            logger.info(`Select ID işleniyor: ${selectId}`);

            // Bu select ID'sini işlenmiş olarak işaretle
            processedSelectIds.add(selectId);

            // Select ID'sinden oda ID'sini çıkar
            const roomIdMatch = selectId.match(/hprt_nos_select_(\d+)_/);
            if (!roomIdMatch) {
              logger.warn(`Select ID: ${selectId} için oda ID'si çıkarılamadı, atlanıyor`);
              continue;
            }

            const roomId = roomIdMatch[1];
            logger.info(`Oda ID: ${roomId}`);

            // Select içindeki tüm option'ları bul
            const options = await select.findElements(By.css('option'));
            logger.info(`${options.length} option bulundu`);

            if (options.length <= 1) {
              logger.warn(`Select: ${selectId} için yeterli option bulunamadı`);
              continue;
            }

            // Son option (maximum değer) değerini al
            const maxOption = options[options.length - 1];
            const maxValue = parseInt(await maxOption.getAttribute('value'), 10);
            logger.info(`Maksimum oda sayısı: ${maxValue} (Option index: ${options.length - 1})`);

            // Bu satır için fiyat bilgisini bul
            const priceCell = await driver.findElement(By.css(`${rowSelector} > td.hprt-table-cell.hprt-table-cell-price`)).catch(() => null);
            let price = null;

            if (priceCell) {
              const priceElement = await priceCell.findElement(By.css('.prco-valign-middle-helper')).catch(() => null);
              if (priceElement) {
                const priceText = await priceElement.getText();
                price = cleanPrice(priceText);
              }
            }

            // Oda ismini bul
            const nameCell = await driver.findElement(By.css(`${rowSelector} > td.hprt-table-cell.hprt-table-cell-roomtype`)).catch(() => null);
            let roomName = 'Standart Oda'; // Varsayılan

            if (nameCell) {
              const nameElement = await nameCell.findElement(By.css('.hprt-roomtype-icon-link')).catch(() => null);
              if (nameElement) {
                roomName = await nameElement.getText();
              }
            }

            // Bu oda ID'si daha önce işlendiyse, sadece bilgileri güncelle
            if (uniqueRoomsByRoomId.has(roomId)) {
              const existingRoom = uniqueRoomsByRoomId.get(roomId);
              if (price && (!existingRoom.price || price < existingRoom.price)) {
                existingRoom.price = price;
                if (price < minPrice) {
                  minPrice = price;
                }
              }
              if (maxValue > existingRoom.roomsLeft) {
                existingRoom.roomsLeft = maxValue;
              }
              logger.info(`Mevcut oda güncellendi: ${roomName}, Müsait: ${existingRoom.roomsLeft}, Fiyat: ${existingRoom.price}`);
            } else {
              // Yeni oda ise ekle
              uniqueRoomsByRoomId.set(roomId, {
                roomName,
                roomsLeft: maxValue,
                price,
                roomId
              });
              if (price && price < minPrice) {
                minPrice = price;
              }
              logger.info(`Yeni oda bulundu: ${roomName}, Müsait: ${maxValue}, Fiyat: ${price}, Oda ID: ${roomId}`);
            }
          } catch (error) {
            logger.error(`Satır ${rowIndex}'deki select elementi işlenirken hata: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Satır ${rowIndex} işlenirken hata oluştu: ${error.message}`);
      }
    }

    // Hiç oda bulunamadıysa alternatif yöntem deneme
    if (uniqueRoomsByRoomId.size === 0) {
      logger.warn('Standart selector ile oda bulunamadı, alternatif yöntem deneniyor...');
      const allSelects = await driver.findElements(By.css('select[id^="hprt_nos_select_"]'));
      logger.info(`Sayfa genelinde ${allSelects.length} select elementi bulundu`);
      for (const select of allSelects) {
        try {
          const selectId = await select.getAttribute('id');
          if (processedSelectIds.has(selectId)) continue;
          processedSelectIds.add(selectId);
          const roomIdMatch = selectId.match(/hprt_nos_select_(\d+)_/);
          if (!roomIdMatch) continue;
          const roomId = roomIdMatch[1];
          const options = await select.findElements(By.css('option'));
          if (options.length <= 1) continue;
          const maxOption = options[options.length - 1];
          const maxValue = parseInt(await maxOption.getAttribute('value'), 10);
          if (uniqueRoomsByRoomId.has(roomId)) {
            const existingRoom = uniqueRoomsByRoomId.get(roomId);
            if (maxValue > existingRoom.roomsLeft) {
              existingRoom.roomsLeft = maxValue;
            }
          } else {
            uniqueRoomsByRoomId.set(roomId, {
              roomName: 'Standart Oda',
              roomsLeft: maxValue,
              price: null,
              roomId
            });
          }
        } catch (error) {
          logger.error(`Alternatif select elementi işlenirken hata: ${error.message}`);
        }
      }
    }

    // Sonuçları döndür
    const roomsList = Array.from(uniqueRoomsByRoomId.values());
    totalAvailableRooms = roomsList.reduce((total, room) => total + room.roomsLeft, 0);
    logger.info(`Oda bilgileri toplandı: ${totalAvailableRooms} müsait oda, ${uniqueRoomsByRoomId.size} benzersiz oda tipi`);

    return {
      totalAvailableRooms: totalAvailableRooms,
      uniqueRoomTypes: uniqueRoomsByRoomId.size,
      minPrice: minPrice === Infinity ? null : minPrice,
      rooms: roomsList
    };
  } catch (error) {
    logger.error(`Oda bilgileri toplanırken hata: ${error.message}`);
    return {
      totalAvailableRooms: 0,
      uniqueRoomTypes: 0,
      minPrice: null,
      rooms: []
    };
  }
}

/**
 * Otel linklerini dosyadan oku
 * @param {string} filePath - Okunacak dosya yolu
 * @returns {Promise<Array<string>>} Hotel linkleri
 */
async function readHotelLinks(filePath) {
  try {
    const content = await fsp.readFile(filePath, 'utf8');
    const links = content.split('\n').filter(link => link.trim() !== '');
    logger.info(`${links.length} otel linki okundu: ${filePath}`);
    return links;
  } catch (error) {
    logger.error(`Hotel linkleri okunamadı: ${error.message}`);
    return [];
  }
}

/**
 * Otel adını bulmak için kullanılan yardımcı fonksiyon
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @returns {Promise<string>} Otel adı
 */
async function findHotelName(driver) {
  const selectors = [
    'h2.pp-header__title', '#hp_hotel_name', '#hotel_title', '.hp__hotel-name',
    '.hotel-name', '.item-name', 'h1.b-beo_title', 'h1.d2fee87262', 'h2.d2fee87262'
  ];
  for (const selector of selectors) {
    try {
      const element = await driver.findElement(By.css(selector));
      const name = await element.getText();
      if (name && name.trim().length > 0) return name.trim();
    } catch (e) { /* Bir sonraki selektörü dene */ }
  }
  try {
    const title = await driver.getTitle();
    if (title && title.includes('|')) return title.split('|')[0].trim();
  } catch (e) { /* Devam et */ }
  return 'Bilinmeyen Otel';
}

/**
 * Özet bilgileri kaydet
 * @param {Array<Object>} hotelResults - Tüm otel sonuçları
 */
async function saveSummary(hotelResults) {
  try {
    const outputDir = path.join(__dirname, '../../../room_data');
    try { await fsp.access(outputDir); } catch { await fsp.mkdir(outputDir, { recursive: true }); }
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const summaryPath = path.join(outputDir, `summary_${dateStr}.csv`);
    const headers = 'HotelName,Url,Location,Rating,TotalRoomsLeft,MinPrice,MaxPrice,ScrapedDate\n';
    const rows = hotelResults.map(hotel => {
      const minPrice = hotel.rooms.length > 0 ? Math.min(...hotel.rooms.map(r => r.price).filter(p => p > 0)) : 0;
      const maxPrice = hotel.rooms.length > 0 ? Math.max(...hotel.rooms.map(r => r.price).filter(p => p > 0)) : 0;
      const totalRoomsLeft = hotel.rooms.reduce((sum, room) => sum + (room.roomsLeft || 0), 0);
      return `"${hotel.name}","${hotel.url}","${hotel.location || ''}",${hotel.rating || 0},${totalRoomsLeft},${minPrice},${maxPrice},"${dateStr}"`;
    }).join('\n');
    await fsp.writeFile(summaryPath, headers + rows, 'utf8');
    logger.info(`${hotelResults.length} otel özeti CSV'ye kaydedildi: ${summaryPath}`);
    return summaryPath;
  } catch (error) {
    logger.error(`Özet bilgiler kaydedilemedi: ${error.message}`);
    return null;
  }
}

// URL'den check-in tarihini çıkaran yardımcı fonksiyon
function getCheckinDateFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        const checkin = url.searchParams.get('checkin');
        if (checkin && /^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
            const date = new Date(checkin + 'T00:00:00Z');
            if (!isNaN(date.getTime())) return date;
        }
    } catch (e) {
        logger.warn(`URL'den checkin tarihi alınamadı: ${urlString}`);
    }
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

/**
 * Tek bir otelin oda bilgilerini çek ve veritabanına kaydet (Tarayıcı örneği dışarıdan alınır)
 * @param {WebDriver} driver - Kullanılacak Selenium WebDriver örneği.
 * @param {string} hotelUrl - Otel URL'i
 * @param {number} index - İşlenen otelin sırası
 * @param {number} totalCount - Toplam otel sayısı
 * @returns {Promise<Object>} Otel ve oda bilgileri (özet için)
 */
async function scrapeSingleHotel(driver, hotelUrl, index, totalCount) {
  let cleanUrl = hotelUrl.trim();
  const startTime = Date.now();
  let hotelRecord = null;
  let dbHotelName = 'Bilinmeyen Otel (DB)';
  let scrapedHotelName = 'Bilinmeyen Otel (Scraped)';

  try {
    logger.info(`[${index}/${totalCount}] İşleniyor: ${cleanUrl}`);

    const checkinDate = getCheckinDateFromUrl(cleanUrl);
    logger.info(`Check-in tarihi: ${checkinDate.toISOString().split('T')[0]}`);

    // Sayfaya git (Driver dışarıdan geldi)
    await driver.get(cleanUrl);
    logger.info('Otel sayfasına gidildi');

    // Otel adını sayfadan çek
    scrapedHotelName = await findHotelName(driver);
    logger.info(`Sayfadan otel adı çekildi: "${scrapedHotelName}"`);

    if (!scrapedHotelName || scrapedHotelName === 'Bilinmeyen Otel') {
        logger.warn(`Sayfadan otel adı alınamadı: ${cleanUrl}. Bu otel atlanıyor.`);
        return { name: 'Sayfadan Ad Alınamadı', url: cleanUrl, error: 'Could not scrape hotel name', durationMs: Date.now() - startTime };
    }

    // Scrape edilen otel adını temizle
    const cleanedScrapedName = scrapedHotelName
                                .replace(/^(Havaalanı servisi)\s*/i, '')
                                .trim();
    logger.info(`Temizlenmiş otel adı: "${cleanedScrapedName}"`);

    // Temizlenmiş otel adıyla veritabanında ara
    hotelRecord = await prisma.hotel.findFirst({
        where: { name: { equals: cleanedScrapedName, mode: 'insensitive' } },
        select: { id: true, name: true, location: true, rating: true }
    });

    if (!hotelRecord) {
      logger.warn(`Veritabanında otel adı "${cleanedScrapedName}" (orijinal: "${scrapedHotelName}") ile eşleşen kayıt bulunamadı (URL: ${cleanUrl}). Bu otel atlanıyor.`);
      return { name: cleanedScrapedName, url: cleanUrl, error: 'Hotel name not found in DB', durationMs: Date.now() - startTime };
    }

    const hotelId = hotelRecord.id;
    dbHotelName = hotelRecord.name;
    logger.info(`Veritabanı ID: ${hotelId}, Veritabanı Otel Adı: "${dbHotelName}"`);

    // Oda detaylarını çek
    const roomResults = await scrapeRoomDetails(driver);

    // Oda verilerini veritabanına kaydet/güncelle
    let savedRoomCount = 0;
    for (const room of roomResults.rooms) {
      try {
        if (!room.roomName || room.roomName.trim() === '') {
            logger.warn(`Boş oda adı bulundu, atlanıyor. Otel ID: ${hotelId}`);
            continue;
        }
        const trimmedRoomName = room.roomName.trim();

        const roomRecordUpsert = await prisma.room.upsert({
          where: { hotelId_roomName: { hotelId: hotelId, roomName: trimmedRoomName } },
          update: {},
          create: { hotelId: hotelId, roomName: trimmedRoomName },
          select: { id: true }
        });
        const roomId = roomRecordUpsert.id;

        await prisma.roomDailyData.upsert({
          where: { roomId_date: { roomId: roomId, date: checkinDate } },
          create: {
            roomId: roomId, date: checkinDate, roomsLeft: room.roomsLeft || 0,
            price: room.price, scrapeDate: new Date()
          },
          update: {
            roomsLeft: room.roomsLeft || 0, price: room.price, scrapeDate: new Date()
          }
        });
        savedRoomCount++;
      } catch (dbError) {
        logger.error(`Oda verisi kaydedilirken hata (Oda: "${room.roomName}", Otel ID: ${hotelId}, Tarih: ${checkinDate.toISOString().split('T')[0]}): ${dbError.message}`, { stack: dbError.stack });
      }
    }
    logger.info(`${savedRoomCount}/${roomResults.rooms.length} oda verisi veritabanına kaydedildi/güncellendi.`);

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    logger.info(`Otel işleme süresi: ${durationMs}ms`);

    return {
      name: dbHotelName, url: cleanUrl, location: hotelRecord.location,
      rating: hotelRecord.rating, rooms: roomResults.rooms,
      totalAvailableRooms: roomResults.totalAvailableRooms,
      minPrice: roomResults.minPrice, uniqueRoomTypes: roomResults.uniqueRoomTypes,
      durationMs: durationMs
    };

  } catch (error) {
    logger.error(`Hata oluştu (${cleanUrl}): ${error.message}`, { stack: error.stack });
    const endTime = Date.now();
    const errorName = hotelRecord ? hotelRecord.name : (scrapedHotelName !== 'Bilinmeyen Otel (Scraped)' ? scrapedHotelName : 'Hata Oluştu');
    return {
      name: errorName, url: cleanUrl, error: error.message,
      durationMs: endTime - startTime
    };
  }
  // finally bloğu kaldırıldı, driver yönetimi scrapeHotelRooms'da
}

/**
 * Verilen link dosyasındaki tüm otellerin oda bilgilerini scrape et ve özet oluştur
 * (Tarayıcı örneği yeniden kullanımı ile)
 * @param {string} linksFile - Otel linklerini içeren dosya yolu
 */
async function scrapeHotelRooms(linksFile) {
  let driver = null; // Driver'ı batch dışında tanımla
  const results = [];
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');
  const WAIT_TIME = parseInt(process.env.WAIT_TIME || '2000');
  const TIMEOUT = parseInt(process.env.TIMEOUT || '60000');

  try {
    logger.info('Oda scraper başlatılıyor (Tarayıcı Yeniden Kullanımı ile)...');
    const hotelLinks = await readHotelLinks(linksFile);
    logger.info(`${hotelLinks.length} otel linki okundu: ${linksFile}`);
    logger.info(`${hotelLinks.length} otel linki işlenecek`);
    logger.info(`Paralel batch boyutu: ${BATCH_SIZE}, Batch arası bekleme: ${WAIT_TIME}ms, Timeout: ${TIMEOUT}ms`);

    // Tarayıcı seçeneklerini ayarla
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--headless=new');
    chromeOptions.addArguments('--disable-gpu');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.addArguments('--window-size=1920,1080');
    if (process.env.DISABLE_IMAGES === 'true') {
      chromeOptions.addArguments('--blink-settings=imagesEnabled=false');
    }
    if (process.env.USER_AGENT) {
      chromeOptions.addArguments(`--user-agent=${process.env.USER_AGENT}`);
    }

    for (let i = 0; i < hotelLinks.length; i += BATCH_SIZE) {
      const batch = hotelLinks.slice(i, i + BATCH_SIZE);
      logger.info(`Batch ${Math.floor(i/BATCH_SIZE) + 1} işleniyor: ${batch.length} otel`);

      try {
        // Her batch için yeni bir driver başlat
        logger.info('Yeni tarayıcı örneği başlatılıyor...');
        driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(chromeOptions)
          .build();

        await driver.manage().setTimeouts({
          implicit: TIMEOUT / 6,
          pageLoad: TIMEOUT,
          script: TIMEOUT / 2
        });
        logger.info('Tarayıcı örneği başlatıldı ve ayarlandı.');

        // Bu batch'teki otelleri aynı driver ile işle
        const batchPromises = batch.map((url, idx) =>
          scrapeSingleHotel(driver, url, i + idx + 1, hotelLinks.length) // driver'ı geçir
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

      } catch (batchError) {
          logger.error(`Batch işlenirken kritik hata: ${batchError.message}`, { stack: batchError.stack });
          // Hata durumunda bile sonuçları eklemeye çalış (kısmi olabilir)
          // results.push(...batch.map(url => ({ name: 'Batch Hatası', url, error: batchError.message })));
      } finally {
          // Batch bittikten veya hata oluştuktan sonra driver'ı kapat
          if (driver) {
              logger.info('Tarayıcı örneği kapatılıyor...');
              await driver.quit().catch(e => logger.error(`Driver kapatılırken hata: ${e.message}`));
              driver = null; // Referansı temizle
              logger.info('Tarayıcı örneği kapatıldı.');
          }
      }

      // Batch'ler arasında bekleme
      if (i + BATCH_SIZE < hotelLinks.length) {
        logger.info(`Batch arası ${WAIT_TIME}ms bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
      }
    }

    // --- Özetleme ve Sonuç ---
    const hotelResults = results.filter(r => r && !r.error);
    const totalSuccess = hotelResults.length;
    const totalErrors = results.length - totalSuccess;
    logger.info('================================================');
    logger.info('Booking.com Oda Scraper İşlem Özeti:');
    logger.info('================================================');
    logger.info(`Toplam İşlenen Link: ${results.length}`);
    logger.info(`Başarıyla İşlenen Otel: ${totalSuccess}`);
    logger.info(`Hatalı/Atlanan: ${totalErrors}`);
    logger.info('================================================');

    if (hotelResults.length > 0) {
      const summaryPath = await saveSummary(hotelResults);
      if (summaryPath) logger.info(`Özet bilgiler şuraya kaydedildi: ${summaryPath}`);
    }

    return results;
  } catch (error) {
    logger.error(`Genel Scraper hatası: ${error.message}`, { stack: error.stack });
    // Genel hata durumunda bile driver'ı kapatmaya çalış
    if (driver) {
        await driver.quit().catch(e => logger.error(`Genel hata sonrası driver kapatılırken hata: ${e.message}`));
    }
    return [{ error: error.message }];
  }
}

module.exports = {
  getMaxRoomsFromSelect,
  cleanPrice,
  scrapeRoomDetails,
  readHotelLinks,
  findHotelName,
  saveSummary,
  scrapeSingleHotel,
  scrapeHotelRooms
};