const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const logger = require('./logger');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Selenium WebDriver tarayıcı başlatma
 * @returns {Promise<WebDriver>} Başlatılan WebDriver tarayıcı örneği
 */
async function initBrowser() {
  try {
    logger.info('Tarayıcı başlatılıyor...');
    
    // Chrome seçeneklerini ayarlama
    const options = new chrome.Options();
    
    // Headless mod kontrolü
    if (process.env.HEADLESS === 'true') {
      options.headless();
    }
    
    // User Agent ayarlama
    if (process.env.USER_AGENT) {
      options.addArguments(`--user-agent=${process.env.USER_AGENT}`);
    }
    
    // Performans ve stabilite ayarları
    options.addArguments(
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
      '--disable-features=site-per-process',
      '--disable-extensions',
      '--disable-sync'
    );
    
    // WebDriver oluşturma
    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Window boyutunu ayarlama
    await driver.manage().window().setRect({ width: 1366, height: 768 });
    
    logger.info('Tarayıcı başarıyla başlatıldı');
    return driver;
  } catch (error) {
    logger.error(`Tarayıcı başlatılırken hata oluştu: ${error.message}`);
    throw error;
  }
}

/**
 * Tarayıcıyı kapatma
 * @param {WebDriver} driver - Selenium WebDriver örneği
 */
async function closeBrowser(driver) {
  if (!driver) return;
  
  try {
    logger.info('Tarayıcı kapatılıyor...');
    await driver.quit();
    logger.info('Tarayıcı başarıyla kapatıldı');
  } catch (error) {
    logger.error(`Tarayıcı kapatılırken hata oluştu: ${error.message}`);
  }
}

/**
 * İnsan benzeri davranış simülasyonu
 * @param {WebDriver} driver - Selenium WebDriver örneği
 */
async function simulateHumanBehavior(driver) {
  try {
    // Rastgele bekleme süresi
    const minWait = parseInt(process.env.WAIT_TIME_MIN) || 2000;
    const maxWait = parseInt(process.env.WAIT_TIME_MAX) || 5000;
    const waitTime = Math.floor(Math.random() * (maxWait - minWait + 1)) + minWait;
    
    // Rastgele scroll
    await driver.executeScript(`
      window.scrollTo({
        top: Math.floor(Math.random() * window.innerHeight * 0.7),
        behavior: 'smooth'
      });
    `);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } catch (error) {
    logger.warn(`İnsan benzeri davranış simüle edilirken hata oluştu: ${error.message}`);
  }
}

/**
 * Sayfa tamamen yüklenene kadar bekle
 * @param {WebDriver} driver - Selenium WebDriver örneği
 */
async function waitForPageLoad(driver) {
  try {
    await driver.wait(async () => {
      const readyState = await driver.executeScript('return document.readyState');
      return readyState === 'complete';
    }, 30000);
  } catch (error) {
    logger.warn(`Sayfa yüklenirken zaman aşımı oluştu: ${error.message}`);
  }
}

/**
 * Yeniden denemeleri ile birlikte işlem gerçekleştirme
 * @param {Function} fn - Yürütülecek asenkron fonksiyon
 * @param {number} maxRetries - Maksimum yeniden deneme sayısı
 * @param {number} retryDelay - Yeniden denemeler arasındaki bekleme süresi (ms)
 * @returns {Promise<any>} İşlem sonucu
 */
async function withRetry(fn, maxRetries = 3, retryDelay = 2000) {
  const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || maxRetries;
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      retries++;
      logger.warn(`Yeniden deneme ${retries}/${MAX_RETRIES}: ${error.message}`);
      
      if (retries === MAX_RETRIES) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
    }
  }
  
  throw lastError;
}

module.exports = {
  initBrowser,
  closeBrowser,
  simulateHumanBehavior,
  waitForPageLoad,
  withRetry
}; 