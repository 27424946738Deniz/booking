const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { saveHotelData } = require('../models/database');

/**
 * Toplam otel sayısını al
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @returns {Promise<number>} Toplam otel sayısı
 */
async function getTotalHotels(driver) {
  try {
    // Başlıktaki toplam otel sayısını bul
    const titleSelector = '#bodyconstraint-inner > div > div > div.af5895d4b2 > div.df7e6ba27d > div.bcbf33c5c3 > div.efdb2b543b.e4b7a69a57.fe7b9a9999 > h1';
    
    // Başlık elementinin yüklenmesini bekle (maksimum 20 saniye)
    await driver.wait(until.elementLocated(By.css(titleSelector)), 20000);
    
    // Element görünür olana kadar bekle
    const titleElement = await driver.findElement(By.css(titleSelector));
    await driver.wait(until.elementIsVisible(titleElement), 10000);
    
    // Sayfanın tamamen yüklenmesi için ek bekleme
    await driver.sleep(3000);
    
    // Metni al ve sayıyı çıkar
    const titleText = await titleElement.getText();
    logger.info(`Başlık metni: ${titleText}`);
    
    const match = titleText.match(/(\d+)/);
    if (match) {
      const total = parseInt(match[1]);
      logger.info(`Toplam ${total} otel bulundu`);
      return total;
    }
    
    logger.warn('Toplam otel sayısı bulunamadı');
    return 0;
  } catch (error) {
    logger.error(`Toplam otel sayısı alınırken hata: ${error.message}`);
    return 0;
  }
}

/**
 * "Load More" butonunu kullanarak daha fazla otel yükle
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @param {number} totalHotels - Toplam otel sayısı
 * @returns {Promise<void>}
 */
async function loadAllResults(driver, totalHotels) {
  try {
    let previousHotelCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    let finalCheckDone = false; // Yeni eklenen flag: Son kontrol yapıldı mı?
    
    // Load More butonu için ana seçici
    const mainLoadMoreSelector = '#bodyconstraint-inner > div > div > div.af5895d4b2 > div.df7e6ba27d > div.bcbf33c5c3 > div.dcf496a7b9.bb2746aad9 > div.d4924c9e74 > div.c82435a4b8.f581fde0b8 > button';
    
    // Yedek Load More buton seçicileri
    const backupLoadMoreSelectors = [
      'button[data-testid="load-more-button"]',
      'button.show_more_button',
      '.js-load-more-button',
      'button.c82435a4b8'
    ];
    
    while (true) {
      // Mevcut otel kartlarını say
      const hotelCards = await driver.findElements(By.css('div[data-testid="property-card"]'));
      const currentHotelCount = hotelCards.length;
      
      logger.info(`Şu anki otel sayısı: ${currentHotelCount}`);
      
      // Son otele scroll yap ve bekle
      if (hotelCards.length > 0) {
        const lastHotel = hotelCards[hotelCards.length - 1];
        
        // Son otele hızlı scroll
        await driver.executeScript('arguments[0].scrollIntoView(true);', lastHotel);
        logger.info('Son otele scroll yapıldı');
        
        // Kısa bekleme
        await driver.sleep(1000);
        
        // Load More butonunu bul ve tıkla (önce ana seçiciyi dene)
        try {
          const mainButton = await driver.findElement(By.css(mainLoadMoreSelector));
          const isDisplayed = await mainButton.isDisplayed();
          
          if (isDisplayed) {
            // Butona direkt tıkla
            await mainButton.click();
            logger.info('Ana Load More butonuna tıklandı');
            consecutiveFailures = 0; // Başarılı tıklama, sayacı sıfırla
            finalCheckDone = false; // Yeni başarılı tıklama olduğu için son kontrol false
            
            // Kısa bekleme
            await driver.sleep(2000);
            continue;
          }
        } catch (err) {
          logger.warn('Ana Load More butonu bulunamadı, yedek seçiciler deneniyor');
          
          // Yedek seçicileri dene
          let buttonFound = false;
          for (const selector of backupLoadMoreSelectors) {
            try {
              const buttons = await driver.findElements(By.css(selector));
              for (const button of buttons) {
                const isDisplayed = await button.isDisplayed();
                const text = await button.getText();
                
                if (isDisplayed && /show|more|load|next/i.test(text)) {
                  // Direkt tıkla
                  await button.click();
                  logger.info(`Yedek Load More butonuna tıklandı (${selector})`);
                  
                  buttonFound = true;
                  consecutiveFailures = 0; // Başarılı tıklama, sayacı sıfırla
                  finalCheckDone = false; // Yeni başarılı tıklama olduğu için son kontrol false
                  await driver.sleep(2000);
                  break;
                }
              }
              if (buttonFound) break;
            } catch (btnErr) {
              continue;
            }
          }
          
          if (!buttonFound) {
            consecutiveFailures++; // Buton bulunamadı, sayacı artır
            logger.warn(`Hiçbir Load More butonu bulunamadı (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
            await driver.sleep(1000);
            
            // Maksimum başarısız denemeye ulaşıldı mı kontrol et
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              // Eğer son kontrol daha yapılmadıysa, bir kez daha scroll yapalım ve bekleyelim
              if (!finalCheckDone) {
                logger.info('Maksimum başarısız sayısına ulaşıldı, son bir kontrol daha yapılıyor...');
                
                // Sayfanın en altına scroll yapalım
                await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
                logger.info('Sayfanın en altına scroll yapıldı');
                
                // Biraz daha uzun bekleyelim (son otellerin yüklenmesi için)
                await driver.sleep(5000);
                
                // Son kontrol yapıldı olarak işaretle
                finalCheckDone = true;
                
                // Otel kartlarını yeniden say
                const finalCheckCards = await driver.findElements(By.css('div[data-testid="property-card"]'));
                const finalCheckCount = finalCheckCards.length;
                
                if (finalCheckCount > currentHotelCount) {
                  logger.info(`Son kontrolde ${finalCheckCount - currentHotelCount} yeni otel daha bulundu`);
                  previousHotelCount = finalCheckCount;
                  // Son kontrol sonrası yeni oteller bulundu, döngüye devam edip bir kez daha deneyelim
                  consecutiveFailures = 0;
                  continue;
                } else {
                  logger.info('Son kontrolde yeni otel bulunamadı, işlem sonlandırılıyor');
                  break;
                }
              } else {
                logger.info('Son kontrol de yapıldı, otel yükleme işlemi sonlandırılıyor');
                break;
              }
            }
          }
        }
        
        // Yeni otellerin yüklenip yüklenmediğini kontrol et
        const newHotelCards = await driver.findElements(By.css('div[data-testid="property-card"]'));
        const newCount = newHotelCards.length;
        
        if (newCount > currentHotelCount) {
          logger.info(`Yeni oteller yüklendi: ${newCount - currentHotelCount} adet`);
          previousHotelCount = newCount;
        }
      }
    }
    
    logger.info(`Toplam ${previousHotelCount} otel yüklendi`);
  } catch (error) {
    logger.error(`Oteller yüklenirken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Otel detaylarını dosyaya ve veritabanına kaydet
 * @param {Array<Object>} hotels - Otel detayları
 */
async function saveHotelDetails(hotels) {
  try {
    // İsim temizleme fonksiyonu
    const cleanName = (name) => {
      return name
        .replace(/Yeni pencerede açılır/g, '')
        .replace(/\n/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
    };
    
    // Veritabanına kaydet
    for (const hotel of hotels) {
      try {
        const cleanedName = cleanName(hotel.name);
        await saveHotelData({
          name: cleanedName,
          url: hotel.url,
          location: hotel.location || null,
          rating: hotel.rating || null,
          minPrice: null,
          totalAvailableRooms: 0
        });
        logger.info(`${cleanedName} oteli veritabanına kaydedildi`);
      } catch (dbError) {
        logger.error(`Otel veritabanına kaydedilirken hata: ${dbError.message}`);
      }
    }
    
    // Çıktı için metni oluştur
    const content = hotels.map(hotel => {
      const cleanedName = cleanName(hotel.name);
      return `NAME: ${cleanedName}\nURL: ${hotel.url}\nLOCATION: ${hotel.location || 'Unknown'}\nRATING: ${hotel.rating || 'Unknown'}\n${'='.repeat(50)}\n`;
    }).join('\n');

    // Dosyaya ekle (üzerine yazma)
    // Dosyanın başına newline ekleyerek önceki çalıştırmalardan ayır
    await fs.appendFile('hotel_details.txt', '\n' + content, 'utf8');
    logger.info(`${hotels.length} otelin detayları hotel_details.txt dosyasına eklendi`);
    
    // Room scraper için özel format
    const roomScraperFormat = hotels.map(hotel => {
      return `${hotel.url}`;
    }).join('\n');
    
    // Room scraper için dosyaya ekle (üzerine yazma)
    // Dosyanın başına newline ekleyerek önceki çalıştırmalardan ayır
    await fs.appendFile('hotel_links.txt', '\n' + roomScraperFormat, 'utf8');
    logger.info(`${hotels.length} otel URL'i hotel_links.txt dosyasına eklendi`);
  } catch (error) {
    logger.error(`Otel detayları kaydedilirken hata oluştu: ${error.message}`);
  }
}

/**
 * Otel puanını çıkar
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @param {WebElement} hotel - Otel kartı elementi
 * @returns {Promise<number|null>} Otel puanı
 */
async function extractHotelRating(driver, hotel) {
  try {
    // Puan seçicileri (en spesifikten en genele doğru)
    const ratingSelectors = [
      '#bodyconstraint-inner div.af5895d4b2 div.df7e6ba27d div.bcbf33c5c3 div.dcf496a7b9.bb2746aad9 div.d4924c9e74 div:nth-child(46) div.c066246e13.d8aec464ca div.c1edfbabcb div div.c624d7469d.f034cf5568.a937b09340.a3214e5942.f02fdbd759 div:nth-child(2) div div div.a3b8729ab1',
      'div[data-testid="property-card"] div.a3b8729ab1',
      'div.c624d7469d div.a3b8729ab1',
      'div.a3b8729ab1.d86cee9b25',
      '[data-testid="rating-stars"]',
      '[data-testid="rating-circles"]',
      '[data-testid="review-score"] div',
      '.a3b8729ab1'
    ];
    
    for (const selector of ratingSelectors) {
      try {
        // Önce otel kartı içinde ara
        const elements = await hotel.findElements(By.css(selector));
        for (const element of elements) {
          const isDisplayed = await element.isDisplayed();
          if (isDisplayed) {
            const ratingText = await element.getText();
            // Sadece sayısal değerleri al
            const ratingMatch = ratingText.replace(',', '.').match(/(\d+[.,]\d+|\d+)/);
            if (ratingMatch) {
              const rating = parseFloat(ratingMatch[0]);
              
              if (!isNaN(rating) && rating > 0 && rating <= 10) {
                logger.info(`Otel puanı bulundu: ${rating}`);
                return rating;
              }
            }
          }
        }
      } catch (err) {
        continue;
      }
    }
    
    logger.warn('Otel puanı bulunamadı');
    return null;
  } catch (error) {
    logger.error(`Otel puanı alınırken hata: ${error.message}`);
    return null;
  }
}

/**
 * Otel lokasyonunu çıkar
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @param {WebElement} hotel - Otel kartı elementi
 * @returns {Promise<string|null>} Otel lokasyonu
 */
async function extractHotelLocation(driver, hotel) {
  try {
    // Lokasyon seçicileri (en spesifikten en genele doğru)
    const locationSelectors = [
      '[data-testid="address"]',
      '.address span',
      '.dc5041d860 span span:first-child',
      '.f4bd0794db b',
      '.aee5343fdb',
      '.a1b3f50dcd b',
      '.f4bd0794db',
      '.address',
      '.a08d7e955e'
    ];
    
    for (const selector of locationSelectors) {
      try {
        // Önce otel kartı içinde ara
        const elements = await hotel.findElements(By.css(selector));
        for (const element of elements) {
          const isDisplayed = await element.isDisplayed();
          if (isDisplayed) {
            const locationText = await element.getText();
            
            // Boş veya "Yeni pencerede açılır" içeren metinleri atla
            if (locationText && !locationText.includes('Yeni pencerede açılır')) {
              // Gereksiz boşlukları temizle
              const cleanLocation = locationText
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/Haritada göster/gi, '')
                .replace(/Merkezi konum/gi, '')
                .trim();
                
              if (cleanLocation) {
                logger.info(`Otel lokasyonu bulundu: ${cleanLocation}`);
                return cleanLocation;
              }
            }
          }
        }
      } catch (err) {
        continue;
      }
    }
    
    logger.warn('Otel lokasyonu bulunamadı');
    return null;
  } catch (error) {
    logger.error(`Otel lokasyonu alınırken hata: ${error.message}`);
    return null;
  }
}

/**
 * Booking.com'dan otel verilerini scrape etme ana fonksiyonu
 * 
 * @param {string} searchUrl - Booking.com arama URL'i
 * @param {Object} options - Scraping seçenekleri
 * @returns {Promise<Object>} Scraping sonuçları
 */
async function scrapeHotels(searchUrl, options = {}) {
  const defaultOptions = {
    maxHotels: 1000,
    maxPagesToLoad: 50,
  };
  
  const config = { ...defaultOptions, ...options };
  let driver = null;
  
  try {
    logger.info('Booking.com scraper başlatılıyor...');
    logger.info(`Arama URL'i: ${searchUrl}`);
    
    // Chrome seçeneklerini ayarla
    const chromeOptions = new chrome.Options();
    // Headless ayarları kaldırıldı, her zaman görünür modda çalışacak.
    
    // Tarayıcıyı başlat
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    
    // Sayfaya git
    await driver.get(searchUrl);
    await driver.sleep(5000);
    
    // Tüm otelleri yükle
    await loadAllResults(driver);
    
    // Otel kartlarını topla
    const hotelCards = await driver.findElements(By.css('div[data-testid="property-card"]'));
    logger.info(`${hotelCards.length} otel kartı bulundu`);
    
    const results = {
      totalHotels: 0,
      totalRooms: 0,
      hotels: [],
      errors: []
    };

    // Her otel için bilgileri çıkar
    for (let i = 0; i < Math.min(hotelCards.length, config.maxHotels); i++) {
      try {
        const hotel = hotelCards[i];
        
        // Otel adını ve URL'ini al
        let name = null;
        let url = null;
        let location = null;
        let rating = null;

        try {
          // Otel adı ve URL'i
          const titleLink = await hotel.findElement(By.css('[data-testid="title"] a, [data-testid="title-link"], .c624d7469d a'));
          name = await titleLink.getText();
          url = await titleLink.getAttribute('href');
          
          // Lokasyon bilgisi
          location = await extractHotelLocation(driver, hotel);
          
          // Puan bilgisi
          rating = await extractHotelRating(driver, hotel);
        } catch (err) {
          logger.warn(`Otel #${i + 1} için temel bilgiler bulunamadı: ${err.message}`);
          continue;
        }
        
        // Otel bilgilerini kaydet
        const hotelInfo = {
          name,
          url,
          location,
          rating
        };
        
        // Sonuçları kaydet
        if (name && url) {
          results.hotels.push(hotelInfo);
          results.totalHotels++;
          
          logger.info(`İşlenen otel: ${name} - Lokasyon: ${location || 'Unknown'} - Puan: ${rating || 'Unknown'}`);
        }
        
        // Her 10 otelde bir bekle
        if ((i + 1) % 10 === 0) {
          logger.info(`${i + 1} otel işlendi, kısa mola veriliyor...`);
          await driver.sleep(2000);
        }
        
      } catch (error) {
        logger.error(`Otel işlenirken hata: ${error.message}`);
        results.errors.push({
          index: i,
          error: error.message
        });
      }
    }

    // Detayları kaydet
    await saveHotelDetails(results.hotels);
    
    // Sonuçları göster
    logger.info('================================================');
    logger.info('Booking.com Scraper İşlem Özeti:');
    logger.info('================================================');
    logger.info(`Toplam İşlenen Otel: ${results.totalHotels}`);
    logger.info(`Toplam Hata: ${results.errors.length}`);
    
    // İşlem süresini hesapla
    const endTime = new Date();
    const elapsedMinutes = ((endTime - startTime) / 1000 / 60).toFixed(1);
    logger.info(`İşlem Süresi: ${elapsedMinutes} dakika`);
    logger.info('================================================');
    
    return results;
    
  } catch (error) {
    logger.error(`Scraping sırasında kritik hata: ${error.message}`);
    throw error;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

// İşlem başlangıç zamanı
const startTime = new Date();

module.exports = {
  scrapeHotels
}; 