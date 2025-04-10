const { By, Key } = require('selenium-webdriver');
const logger = require('../utils/logger');
const { initBrowser, closeBrowser, simulateHumanBehavior, waitForPageLoad, withRetry } = require('../utils/browserUtils');
const { navigateToSearchPage, loadMoreResults } = require('./navigation');
const { processHotelDetailPage } = require('./processHotel');
const { saveHotelData, getTodayHotelCount } = require('../models/database');

/**
 * Booking.com'dan otel verilerini scrape etme ana fonksiyonu
 * 
 * @param {string} searchUrl - Booking.com arama URL'i
 * @param {Object} options - Scraping seçenekleri
 * @returns {Promise<Object>} Scraping sonuçları
 */
async function scrapeHotels(searchUrl, options = {}) {
  const defaultOptions = {
    maxHotels: 100,            // Maximum otel sayısı
    processDetailPages: true,  // Detay sayfalarını işle
    maxPagesToLoad: 10,        // Maksimum sayfa sayısı
    saveToDatabase: true,      // Veritabanına kaydet
  };
  
  const config = { ...defaultOptions, ...options };
  let driver = null;
  
  try {
    logger.info('Booking.com scraper başlatılıyor...');
    logger.info(`Arama URL'i: ${searchUrl}`);
    logger.info(`Maksimum otel sayısı: ${config.maxHotels}`);
    
    // Tarayıcı başlat
    driver = await initBrowser();
    
    // Arama sayfasına git
    await navigateToSearchPage(driver, searchUrl);
    
    // Bugün kaydettiğimiz otelleri kontrol et
    const todayHotelCount = await getTodayHotelCount();
    logger.info(`Bugün şu ana kadar ${todayHotelCount} otel kaydedildi`);
    
    // "Load More" butonuyla daha fazla sonuç yükle
    await loadMoreResults(driver, config.maxPagesToLoad);
    
    // Otel kartlarını topla
    const hotelCards = await withRetry(async () => {
      // Tüm otel kartlarını bul
      const hotelCardSelectors = [
        '.sr_property_block',
        '[data-testid="property-card"]',
        '.bui-card--media'
      ];
      
      let cards = [];
      
      for (const selector of hotelCardSelectors) {
        try {
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            cards = elements;
            logger.info(`${elements.length} otel kartı bulundu (${selector})`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      return cards;
    });
    
    // Maksimum otel sayısını kontrol et
    const hotelCount = Math.min(hotelCards.length, config.maxHotels);
    logger.info(`İşlenecek otel sayısı: ${hotelCount}`);
    
    // Sonuçları tutacak dizi
    const results = {
      totalHotels: 0,
      totalRooms: 0,
      hotels: [],
      errors: []
    };
    
    // Her otel kartı için işlem yap
    for (let i = 0; i < hotelCount; i++) {
      try {
        logger.info(`Otel ${i + 1}/${hotelCount} işleniyor...`);
        
        // Otel URL'ini al
        const hotelUrl = await withRetry(async () => {
          try {
            // Otel linkini bul
            const linkSelectors = [
              'a.hotel_name_link',
              'a.bui-card__title-link',
              '[data-testid="property-card"] a',
              'a.property-card__title-link'
            ];
            
            for (const selector of linkSelectors) {
              try {
                const linkElement = await hotelCards[i].findElement(By.css(selector));
                return await linkElement.getAttribute('href');
              } catch (err) {
                continue;
              }
            }
            
            throw new Error('Otel linki bulunamadı');
          } catch (err) {
            logger.warn(`Otel URL'i alınamadı: ${err.message}`);
            throw err;
          }
        });
        
        // Detay sayfasını işle
        if (config.processDetailPages && hotelUrl) {
          // Yeni sekmede aç
          const currentHandle = await driver.getWindowHandle();
          await driver.executeScript('window.open(arguments[0]);', hotelUrl);
          
          // Yeni sekmeye geç
          const handles = await driver.getAllWindowHandles();
          const newTab = handles.find(h => h !== currentHandle);
          await driver.switchTo().window(newTab);
          
          // Otel detaylarını işle
          const hotelData = await processHotelDetailPage(driver, hotelUrl);
          
          // Veritabanına kaydet
          if (config.saveToDatabase) {
            await saveHotelData(hotelData);
          }
          
          // İstatistikleri güncelle
          results.totalHotels++;
          results.totalRooms += hotelData.totalAvailableRooms || 0;
          results.hotels.push({
            name: hotelData.name,
            url: hotelData.url,
            totalRooms: hotelData.totalAvailableRooms,
            minPrice: hotelData.minRoomPrice
          });
          
          // Sekmeyi kapat ve ana sekmeye geri dön
          await driver.close();
          await driver.switchTo().window(currentHandle);
        }
        
        // Her 10 otelde bir ek bekleme
        if ((i + 1) % 10 === 0) {
          logger.info(`${i + 1} otel işlendi, kısa mola veriliyor...`);
          await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
        }
      } catch (error) {
        logger.error(`Otel işlenirken hata: ${error.message}`);
        results.errors.push({
          index: i,
          error: error.message
        });
      }
    }
    
    // Özet
    logger.info('Booking.com scraping tamamlandı');
    logger.info(`Toplam ${results.totalHotels} otel işlendi`);
    logger.info(`Toplam ${results.totalRooms} oda bulundu`);
    logger.info(`Hatalar: ${results.errors.length}`);
    
    return results;
    
  } catch (error) {
    logger.error(`Scraping sırasında kritik hata: ${error.message}`);
    throw error;
  } finally {
    // Tarayıcıyı kapat
    if (driver) {
      await closeBrowser(driver);
    }
  }
}

module.exports = {
  scrapeHotels
}; 