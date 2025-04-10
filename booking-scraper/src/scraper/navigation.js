const { By, until } = require('selenium-webdriver');
const logger = require('../utils/logger');
const { simulateHumanBehavior, waitForPageLoad } = require('../utils/browserUtils');

/**
 * Booking.com arama sayfasına git ve yüklenene kadar bekle
 * 
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @param {string} url - Booking.com arama URL'i
 * @returns {Promise<void>}
 */
async function navigateToSearchPage(driver, url) {
  try {
    logger.info(`Arama sayfasına gidiliyor: ${url}`);
    
    // Sayfaya git
    await driver.get(url);
    
    // Sayfanın yüklenmesini bekle
    await waitForPageLoad(driver);
    
    // İnsan benzeri davranış simüle et
    await simulateHumanBehavior(driver);
    
    // Sayfanın doğru yüklendiğini kontrol et
    const title = await driver.getTitle();
    if (title.includes('Booking.com')) {
      logger.info('Arama sayfası başarıyla yüklendi');
    } else {
      logger.warn(`Beklenmeyen sayfa başlığı: ${title}`);
    }
  } catch (error) {
    logger.error(`Arama sayfasına gidilirken hata oluştu: ${error.message}`);
    throw error;
  }
}

/**
 * "Load More" butonunu kullanarak daha fazla otel yükle
 * 
 * @param {WebDriver} driver - Selenium WebDriver örneği
 * @param {number} maxPages - Yüklenecek maksimum ek sayfa sayısı
 * @returns {Promise<number>} Yüklenen ek sayfa sayısı
 */
async function loadMoreResults(driver, maxPages = 10) {
  const LOAD_MORE_MAX_PAGES = parseInt(process.env.LOAD_MORE_MAX_PAGES) || maxPages;
  let currentPage = 1;
  let hasMoreResults = true;
  
  logger.info(`Daha fazla sonuç yükleniyor (maksimum ${LOAD_MORE_MAX_PAGES} sayfa)...`);
  
  while (hasMoreResults && currentPage < LOAD_MORE_MAX_PAGES) {
    try {
      // "Load More" butonunu bekle
      const loadMoreSelectors = [
        '.show_more_button',
        '[data-testid="pagination-next-btn"]',
        '.show-more-button',
        '.results-footer-toolbar',
        '[data-testid="search-results-pagination"]',
        '[data-testid="pagination"]',
        '[data-testid="load-more"]',
        '.bui-pagination__next-arrow'
      ];
      
      logger.debug(`${currentPage}. sayfa için "Load More" butonu aranıyor...`);
      
      // Her bir selector'ı dene
      let loadMoreButton = null;
      for (const selector of loadMoreSelectors) {
        try {
          // Hızlı kontrol, buton var mı?
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            const isVisible = await elements[0].isDisplayed();
            if (isVisible) {
              loadMoreButton = elements[0];
              logger.debug(`"Load More" butonu bulundu: ${selector}`);
              break;
            }
          }
        } catch (err) {
          // Bu selector için hata oluştu, diğer selector'a geç
          continue;
        }
      }
      
      // Buton bulunamadıysa, daha fazla sonuç yok demektir
      if (!loadMoreButton) {
        logger.info('Daha fazla sonuç yüklenemiyor, buton bulunamadı');
        hasMoreResults = false;
        break;
      }
      
      // Butonu görünür yap
      await driver.executeScript('arguments[0].scrollIntoView({behavior: "smooth", block: "center"});', loadMoreButton);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Butona tıkla
      logger.debug(`"Load More" butonuna tıklanıyor...`);
      await loadMoreButton.click();
      
      // Yeni içeriğin yüklenmesini bekle
      await new Promise(resolve => setTimeout(resolve, 3000));
      await waitForPageLoad(driver);
      
      // İnsan benzeri davranış simüle et
      await simulateHumanBehavior(driver);
      
      // Yeni otellerin yüklendiğini kontrol et
      try {
        const hotelCards = await driver.findElements(By.css('.sr_property_block, [data-testid="property-card"]'));
        logger.debug(`Şu ana kadar ${hotelCards.length} otel kartı bulundu`);
      } catch (err) {
        logger.warn('Otel kartları kontrol edilirken hata oluştu');
      }
      
      currentPage++;
    } catch (error) {
      logger.error(`Daha fazla sonuç yüklenirken hata oluştu: ${error.message}`);
      hasMoreResults = false;
    }
  }
  
  logger.info(`Toplam ${currentPage} sayfa sonuç yüklendi`);
  return currentPage;
}

module.exports = {
  navigateToSearchPage,
  loadMoreResults
}; 