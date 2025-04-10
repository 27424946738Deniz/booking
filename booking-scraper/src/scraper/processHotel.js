const { By, until } = require('selenium-webdriver');
const logger = require('../utils/logger');
const { simulateHumanBehavior, waitForPageLoad, withRetry } = require('../utils/browserUtils');

/**
 * Booking.com otel detay sayfasından otel bilgilerini çıkarma
 * 
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @param {string} hotelUrl - Otel detay sayfası URL'i
 * @returns {Promise<Object>} Otel bilgileri
 */
async function processHotelDetailPage(driver, hotelUrl) {
  try {
    logger.info(`Otel sayfası işleniyor: ${hotelUrl}`);
    
    // Otel detay sayfasına git
    await driver.get(hotelUrl);
    
    // Sayfanın yüklenmesini bekle
    await waitForPageLoad(driver);
    
    // İnsan benzeri davranış simüle et
    await simulateHumanBehavior(driver);
    
    // Otel bilgilerini çıkar
    const hotelInfo = await extractHotelInfo(driver);
    
    // Oda bilgilerini çıkar
    const rooms = await extractRoomInfo(driver);
    
    // Otel URL'ini ekle
    hotelInfo.url = hotelUrl;
    
    // Odaları otel bilgilerine ekle
    hotelInfo.rooms = rooms;
    
    // Toplam müsait oda sayısını hesapla
    hotelInfo.totalAvailableRooms = rooms.reduce((total, room) => total + (room.roomsLeft || 0), 0);
    
    // En düşük oda fiyatını hesapla
    const validPrices = rooms
      .map(room => room.price)
      .filter(price => price && !isNaN(price) && price > 0);
    
    hotelInfo.minRoomPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
    
    logger.info(`"${hotelInfo.name}" oteli başarıyla işlendi, ${rooms.length} oda bulundu, toplam ${hotelInfo.totalAvailableRooms} müsait oda var`);
    
    return hotelInfo;
  } catch (error) {
    logger.error(`Otel sayfası işlenirken hata oluştu: ${error.message}`);
    throw error;
  }
}

/**
 * Otel sayfasından otel bilgilerini çıkarma
 * 
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @returns {Promise<Object>} Otel bilgileri
 */
async function extractHotelInfo(driver) {
  try {
    // Otel adı
    const hotelName = await withRetry(async () => {
      const nameSelectors = [
        '[data-testid="property-header"] h2',
        '#hp_hotel_name',
        '.pp-header__title'
      ];
      
      for (const selector of nameSelectors) {
        try {
          const element = await driver.findElement(By.css(selector));
          const text = await element.getText();
          if (text) return text.trim();
        } catch (err) {
          continue;
        }
      }
      
      return 'Bilinmeyen Otel';
    });
    
    // Otel adresi
    const address = await withRetry(async () => {
      const addressSelectors = [
        '[data-testid="property-address"]',
        '.hp_address_subtitle',
        '.address'
      ];
      
      for (const selector of addressSelectors) {
        try {
          const element = await driver.findElement(By.css(selector));
          const text = await element.getText();
          if (text) return text.trim();
        } catch (err) {
          continue;
        }
      }
      
      return null;
    });
    
    // İlçe (district) bilgisini adresten çıkar
    let district = null;
    if (address) {
      // Adres formatı: "Adres Satırı 1, İlçe, İstanbul, Türkiye" gibi olabilir
      const parts = address.split(',');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].includes('Istanbul') || parts[i].includes('İstanbul')) {
          if (i > 0) {
            district = parts[i-1].trim();
            break;
          }
        }
      }
    }
    
    // Otel puanı
    const rating = await withRetry(async () => {
      const ratingSelectors = [
        '[data-testid="review-score-component"] div',
        '.bui-review-score__badge',
        '.rating'
      ];
      
      for (const selector of ratingSelectors) {
        try {
          const element = await driver.findElement(By.css(selector));
          const text = await element.getText();
          if (text) {
            const ratingValue = parseFloat(text.replace(',', '.'));
            if (!isNaN(ratingValue)) return ratingValue;
          }
        } catch (err) {
          continue;
        }
      }
      
      return null;
    });
    
    // Değerlendirme sayısı
    const reviewCount = await withRetry(async () => {
      const reviewCountSelectors = [
        '[data-testid="review-score-component"] div:last-child',
        '.bui-review-score__text',
        '.review-score-widget__subtext'
      ];
      
      for (const selector of reviewCountSelectors) {
        try {
          const element = await driver.findElement(By.css(selector));
          const text = await element.getText();
          if (text) {
            // "123 değerlendirme" gibi metinlerden sayıyı çıkar
            const match = text.match(/(\d+)/);
            if (match) return parseInt(match[1]);
          }
        } catch (err) {
          continue;
        }
      }
      
      return null;
    });
    
    // Otel özellikleri
    const amenities = await withRetry(async () => {
      const amenitySelectors = [
        '.hp_desc_important_facilities [data-name-en]',
        '.facility-badge .facility-badge__title'
      ];
      
      let amenitiesList = [];
      
      for (const selector of amenitySelectors) {
        try {
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            for (const element of elements) {
              const text = await element.getText();
              if (text) amenitiesList.push(text.trim());
            }
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      return amenitiesList;
    });
    
    // Otel açıklaması
    const description = await withRetry(async () => {
      const descriptionSelectors = [
        '.hotel-description-content',
        '#property-description',
        '.property-description',
        '[data-testid="property-description"]'
      ];
      
      for (const selector of descriptionSelectors) {
        try {
          const element = await driver.findElement(By.css(selector));
          const text = await element.getText();
          if (text) return text.trim();
        } catch (err) {
          continue;
        }
      }
      
      return null;
    });
    
    // Otel bilgilerini birleştir ve döndür
    return {
      name: hotelName,
      location: address,
      address,
      district,
      rating,
      reviewCount,
      amenities,
      description
    };
  } catch (error) {
    logger.error(`Otel bilgileri çıkarılırken hata oluştu: ${error.message}`);
    throw error;
  }
}

/**
 * Otel sayfasından oda bilgilerini çıkarma
 * 
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @returns {Promise<Array>} Oda bilgileri
 */
async function extractRoomInfo(driver) {
  try {
    logger.debug('Oda bilgileri çıkarılıyor...');
    
    // Oda satırlarını bul
    const roomSelectors = [
      '.hprt-table tr.js-rt-block-row',
      '[data-testid="rate-plan-header"]',
      '.room-info',
      '[data-testid="property-card"]',
      '.bui-grid__column'
    ];
    
    let roomRows = [];
    
    for (const selector of roomSelectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        if (elements.length > 0) {
          roomRows = elements;
          logger.debug(`${elements.length} oda satırı bulundu (${selector})`);
          break;
        }
      } catch (err) {
        continue;
      }
    }
    
    if (roomRows.length === 0) {
      logger.warn('Hiç oda satırı bulunamadı');
      return [];
    }
    
    // Her oda satırı için bilgileri çıkar
    const rooms = [];
    for (let i = 0; i < roomRows.length; i++) {
      try {
        const row = roomRows[i];
        
        // Oda adı
        let roomName = 'Bilinmeyen Oda';
        try {
          const nameElement = await row.findElement(By.css('.hprt-roomtype-link, .room-name, [data-testid="title"]'));
          roomName = await nameElement.getText();
        } catch (err) {
          // İsim bulunamadı, varsayılan kullan
        }
        
        // Oda fiyatı
        let price = null;
        let originalPrice = null;
        try {
          const priceElements = await row.findElements(By.css('.bui-price-display__value, .prco-valign-middle-helper, [data-testid="price-and-discounted-price"], .price'));
          
          if (priceElements.length > 0) {
            const priceText = await priceElements[0].getText();
            // Fiyattan para birimini ve binlik ayırıcıları temizle
            price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
          }
          
          // İndirimli fiyat varsa (üzeri çizili)
          const originalPriceElements = await row.findElements(By.css('.bui-price-display__original, .strike-it-red, [data-testid="strikethrough-price"]'));
          
          if (originalPriceElements.length > 0) {
            const priceText = await originalPriceElements[0].getText();
            originalPrice = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
          }
        } catch (err) {
          // Fiyat bulunamadı
        }
        
        // Müsait oda sayısı
        let roomsLeft = 0;
        try {
          const roomsLeftElements = await row.findElements(By.css('.hprt-nos-select, [data-testid="select-rooms"], .rooms-left-count'));
          
          if (roomsLeftElements.length > 0) {
            // Seçenek listesi varsa, seçenek sayısı kadar oda vardır
            const options = await roomsLeftElements[0].findElements(By.css('option'));
            roomsLeft = options.length > 0 ? options.length - 1 : 0; // İlk seçenek genelde "Seçim yapın" olduğu için
          } else {
            // roomsLeft metini var mı?
            const roomsLeftTextElements = await row.findElements(By.css('.only_x_left, [data-testid="rooms-left"]'));
            
            if (roomsLeftTextElements.length > 0) {
              const roomsLeftText = await roomsLeftTextElements[0].getText();
              const match = roomsLeftText.match(/(\d+)/);
              if (match) {
                roomsLeft = parseInt(match[1]);
              }
            }
          }
        } catch (err) {
          // Oda sayısı bulunamadı
        }
        
        // Yemek planı
        let mealPlan = null;
        try {
          const mealElements = await row.findElements(By.css('.hprt-meal-plan-cell, [data-testid="meal-plan"], .meal-plan'));
          
          if (mealElements.length > 0) {
            mealPlan = await mealElements[0].getText();
          }
        } catch (err) {
          // Yemek planı bulunamadı
        }
        
        // İptal politikası
        let cancelPolicy = null;
        try {
          const cancelElements = await row.findElements(By.css('.hp_rt_can, [data-testid="cancellation-policy"], .cancellation-policy'));
          
          if (cancelElements.length > 0) {
            cancelPolicy = await cancelElements[0].getText();
          }
        } catch (err) {
          // İptal politikası bulunamadı
        }
        
        // Odayı listeye ekle (fiyat veya oda sayısı varsa)
        if (price || roomsLeft > 0) {
          rooms.push({
            roomName: roomName.trim(),
            price,
            originalPrice,
            roomsLeft,
            mealPlan: mealPlan ? mealPlan.trim() : null,
            cancelPolicy: cancelPolicy ? cancelPolicy.trim() : null
          });
        }
      } catch (rowError) {
        logger.warn(`Oda satırı işlenirken hata oluştu: ${rowError.message}`);
      }
    }
    
    logger.debug(`Toplam ${rooms.length} oda bilgisi çıkarıldı`);
    return rooms;
  } catch (error) {
    logger.error(`Oda bilgileri çıkarılırken hata oluştu: ${error.message}`);
    return [];
  }
}

module.exports = {
  processHotelDetailPage,
  extractHotelInfo,
  extractRoomInfo
}; 