# Booking.com Scraper Uygulama Rehberi

Bu rehber, Booking.com scraper'ının nasıl uygulanacağına dair adımları ve en iyi pratikleri açıklamaktadır.

## 1. Proje Yapısı

```
booking-scraper/
├── src/
│   ├── index.js            // Ana giriş noktası
│   ├── config/             // Konfigürasyon dosyaları
│   │   ├── constants.js    // Sabitler
│   │   └── puppeteer.js    // Puppeteer konfigürasyonu
│   ├── scraper/
│   │   ├── scrapeHotels.js // Ana scraping mantığı
│   │   ├── processHotel.js // Otel işleme
│   │   ├── processRoom.js  // Oda işleme
│   │   └── navigation.js   // Sayfa navigasyonu fonksiyonları
│   ├── utils/
│   │   ├── logger.js       // Winston logger konfigürasyonu
│   │   ├── dateUtils.js    // Tarih işleme fonksiyonları
│   │   ├── priceUtils.js   // Fiyat işleme fonksiyonları
│   │   └── browserUtils.js // Tarayıcı yardımcı fonksiyonları
│   └── models/
│       └── database.js     // Veritabanı işlemleri
├── prisma/
│   └── schema.prisma       // Prisma veri modeli
├── .env                    // Ortam değişkenleri
├── .eslintrc.js           // ESLint konfigürasyonu
├── .prettierrc            // Prettier konfigürasyonu
├── package.json           // Bağımlılıklar
└── README.md              // Proje dokümantasyonu
```

## 2. Uygulama Akışı

### 2.1 Ana Uygulama Akışı

1. Arama URL'ini al (kullanıcı girdisi veya konfigürasyon dosyasından)
2. Puppeteer tarayıcı başlat (optimizasyon ayarları ile)
3. Arama sayfasını aç ve yükle
4. Tüm otel kartlarını topla
5. Her sayfa için "Load More" butonunu kullanarak ek otelleri yükle
6. Her otel için, detay sayfasını aç ve bilgileri çıkar
7. Otel ve oda verilerini veritabanına kaydet

### 2.2 Puppeteer Konfigürasyonu

```javascript
// src/config/puppeteer.js
exports.launchOptions = {
  headless: true,
  executablePath: process.platform === 'darwin' 
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920x1080',
    '--disable-features=site-per-process',
    '--disable-extensions',
    '--disable-sync',
    '--js-flags="--max-old-space-size=512"'
  ],
  defaultViewport: {
    width: 1366,
    height: 768
  }
};
```

### 2.3 "Load More" Butonunu Kullanma

```javascript
// src/scraper/navigation.js
async function loadMoreResults(page, maxPages = 10) {
  let currentPage = 1;
  let hasMoreResults = true;
  
  while (hasMoreResults && currentPage < maxPages) {
    try {
      // "Load More" butonunu bekle
      const loadMoreSelector = '.show_more_button';
      await page.waitForSelector(loadMoreSelector, { timeout: 10000 });
      
      // Butonun görünür olduğunu kontrol et
      const isVisible = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }, loadMoreSelector);
      
      if (!isVisible) {
        hasMoreResults = false;
        break;
      }
      
      // Butona tıklamadan önce görünür olmasını sağla
      await page.evaluate((selector) => {
        const button = document.querySelector(selector);
        if (button) {
          button.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
      }, loadMoreSelector);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tıklama ve yeni içeriğin yüklenmesini bekleme
      await Promise.all([
        page.click(loadMoreSelector),
        page.waitForResponse(response => 
          response.url().includes('booking.com/dml/search_results') && 
          response.status() === 200
        ),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
      // Yeni otellerin yüklenmesini bekle
      await page.waitForFunction(() => {
        const hotels = document.querySelectorAll('.sr_property_block');
        return hotels.length > 0;
      });
      
      currentPage++;
      
      // İnsan davranışı: rastgele scroll
      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(Math.random() * 500));
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
    } catch (error) {
      console.error(`Error loading more results: ${error.message}`);
      hasMoreResults = false;
    }
  }
  
  return currentPage;
}
```

### 2.4 Otel Detay Sayfasını İşleme

```javascript
// src/scraper/processHotel.js
async function processHotelDetailPage(page, hotelUrl) {
  try {
    // Bot tespitini önlemek için User-Agent rotasyonu
    await page.setUserAgent(getRandomUserAgent());

    // Sayfaya git, timeout arttırıldı
    await page.goto(hotelUrl, { 
      timeout: 60000, 
      waitUntil: ['domcontentloaded', 'networkidle2'] 
    });
    
    // İnsan davranışı simülasyonu
    await simulateHumanBehavior(page);
    
    // Otel bilgilerini çıkar
    const hotelInfo = await extractHotelInfo(page);
    
    // Oda bilgilerini çıkar
    const rooms = await extractRoomInfo(page);
    
    return {
      ...hotelInfo,
      rooms
    };
  } catch (error) {
    throw new Error(`Error processing hotel detail page: ${error.message}`);
  }
}

async function simulateHumanBehavior(page) {
  // Rastgele scroll
  await page.evaluate(() => {
    const maxScroll = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    
    const scrollToPosition = (position) => {
      window.scrollTo(0, position);
      return new Promise(resolve => setTimeout(resolve, 100));
    };
    
    const smoothScroll = async (start, end, steps) => {
      for (let i = 0; i <= steps; i++) {
        const position = start + ((end - start) * i / steps);
        await scrollToPosition(position);
      }
    };
    
    return smoothScroll(0, maxScroll * 0.7, 10);
  });
  
  // Rastgele bekleme
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));
}
```

### 2.5 Oda Bilgilerini Çıkarma

```javascript
// src/scraper/processRoom.js
async function extractRoomInfo(page) {
  try {
    // Booking.com'da oda tablosu
    await page.waitForSelector('.hprt-table', { timeout: 30000 });
    
    // Tüm oda satırlarını bul
    const roomRows = await page.$$('.hprt-table > tbody > tr.js-rt-block-row');
    
    // Her bir oda satırı için bilgileri çıkar
    const rooms = [];
    for (const row of roomRows) {
      try {
        const roomData = await page.evaluate(el => {
          // Oda adı
          const nameElement = el.querySelector('.hprt-roomtype-link');
          const roomName = nameElement ? nameElement.textContent.trim() : 'Unknown Room';
          
          // Fiyat (indirimli ve orijinal)
          const priceElement = el.querySelector('.bui-price-display__value');
          let price = null;
          if (priceElement) {
            const priceText = priceElement.textContent.trim();
            // Fiyattan para birimini ve binlik ayırıcıları temizle
            price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
          }
          
          // Orijinal fiyat (üstü çizili fiyat)
          const originalPriceElement = el.querySelector('.bui-price-display__original');
          let originalPrice = null;
          if (originalPriceElement) {
            const priceText = originalPriceElement.textContent.trim();
            originalPrice = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
          }
          
          // Oda müsaitliği / kapasitesi
          const occupancyElement = el.querySelector('.hprt-occupancy-occupancy-info');
          let occupancy = null;
          if (occupancyElement) {
            const occupancyText = occupancyElement.getAttribute('data-occupancy');
            occupancy = occupancyText ? parseInt(occupancyText) : null;
          }
          
          // İptal politikası
          const cancelElement = el.querySelector('.hp_rt_can');
          const cancelPolicy = cancelElement ? cancelElement.textContent.trim() : null;
          
          // Yemek planı
          const mealElement = el.querySelector('.hprt-meal-plan-cell');
          const mealPlan = mealElement ? mealElement.textContent.trim() : null;
          
          // Promosyon var mı?
          const promoElement = el.querySelector('.bundle-display-item');
          const hasPromotion = !!promoElement;
          const promotionDetails = promoElement ? promoElement.textContent.trim() : null;
          
          // Mevcut oda sayısı
          const availabilityElement = el.querySelector('.hprt-nos-select');
          let availableCount = 0;
          
          if (availabilityElement) {
            const options = Array.from(availabilityElement.querySelectorAll('option'));
            availableCount = options.length > 0 ? options.length - 1 : 0; // İlk seçenek genelde "0"
          }
          
          return {
            roomName,
            price,
            originalPrice,
            occupancy,
            cancelPolicy,
            mealPlan,
            hasPromotion,
            promotionDetails,
            availableCount
          };
        }, row);
        
        // Odayı listeye ekle
        if (roomData.roomName !== 'Unknown Room') {
          rooms.push(roomData);
        }
      } catch (roomError) {
        console.error(`Error processing room: ${roomError.message}`);
      }
    }
    
    return rooms;
  } catch (error) {
    throw new Error(`Error extracting room info: ${error.message}`);
  }
}
```

### 2.6 Veritabanına Kaydetme

```javascript
// src/models/database.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function saveHotelData(hotelData) {
  try {
    // Önce otel bilgilerini kaydet
    const hotel = await prisma.hotel.create({
      data: {
        name: hotelData.name,
        location: hotelData.location,
        url: hotelData.url,
        checkInDate: new Date(hotelData.checkInDate),
        scrapeDate: new Date(),
        rating: hotelData.rating,
        reviewCount: hotelData.reviewCount,
        amenities: hotelData.amenities || [],
        totalAvailableRooms: 0, // Başlangıçta 0, sonra güncellenecek
        minRoomPrice: 0 // Başlangıçta 0, sonra güncellenecek
      }
    });
    
    // Hiç oda yoksa hemen dön
    if (!hotelData.rooms || hotelData.rooms.length === 0) {
      return hotel;
    }
    
    let totalRooms = 0;
    let minPrice = Infinity;
    
    // Her oda için veritabanına kaydet
    for (const roomData of hotelData.rooms) {
      await prisma.room.create({
        data: {
          hotelId: hotel.id,
          roomName: roomData.roomName,
          availableCount: roomData.availableCount,
          price: roomData.price,
          originalPrice: roomData.originalPrice,
          mealPlan: roomData.mealPlan,
          cancelPolicy: roomData.cancelPolicy,
          occupancy: roomData.occupancy,
          hasPromotion: roomData.hasPromotion,
          promotionDetails: roomData.promotionDetails,
          scrapeDate: new Date()
        }
      });
      
      // İstatistikleri güncelle
      totalRooms += roomData.availableCount || 0;
      if (roomData.price && roomData.price < minPrice) {
        minPrice = roomData.price;
      }
    }
    
    // Otel istatistiklerini güncelle
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: {
        totalAvailableRooms: totalRooms,
        minRoomPrice: minPrice === Infinity ? null : minPrice
      }
    });
    
    // Günlük kayıt oluştur
    await prisma.hotelDailyRecord.create({
      data: {
        hotelId: hotel.id,
        scrapeDate: new Date(),
        totalAvailableRooms: totalRooms,
        minRoomPrice: minPrice === Infinity ? null : minPrice
      }
    });
    
    return hotel;
  } catch (error) {
    throw new Error(`Error saving hotel data: ${error.message}`);
  }
}

module.exports = {
  saveHotelData
};
```

## 3. Deployment ve İzleme

### 3.1 PM2 ile Deployment

```bash
# PM2 yükleme (bir kere)
npm install -g pm2

# Scraper'ı başlatma
pm2 start src/index.js --name "booking-scraper" --max-memory-restart 1G

# Log'ları görüntüleme
pm2 logs booking-scraper

# Scraper'ı durdurma
pm2 stop booking-scraper

# Scraper'ı sıfırlama (restart)
pm2 restart booking-scraper

# Otomatik başlatma ayarı
pm2 startup
pm2 save
```

### 3.2 Cron ile Zamanlanmış Çalıştırma

Booking.com scraper'ını belirli aralıklarla çalıştırmak için `node-cron` kullanımı:

```javascript
// src/index.js
const cron = require('node-cron');
const { scrapeHotels } = require('./scraper/scrapeHotels');
const logger = require('./utils/logger');

// Her gün saat 00:00'da çalıştır
cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('Starting scheduled Booking.com scraping task');
    await scrapeHotels('https://www.booking.com/searchresults.html?ss=Istanbul');
    logger.info('Scheduled scraping task completed successfully');
  } catch (error) {
    logger.error(`Scheduled scraping task failed: ${error.message}`);
  }
});

// Manuel çalıştırmak için
if (process.argv.includes('--now')) {
  (async () => {
    try {
      logger.info('Starting manual Booking.com scraping task');
      await scrapeHotels('https://www.booking.com/searchresults.html?ss=Istanbul');
      logger.info('Manual scraping task completed successfully');
    } catch (error) {
      logger.error(`Manual scraping task failed: ${error.message}`);
    }
  })();
}
```

## 4. Önemli İpuçları ve En İyi Pratikler

### 4.1 Bot Tespitini Önlemek İçin

1. **Değişken Bekleme Süreleri**:
   ```javascript
   const delay = baseDelay + Math.random() * variance;
   await new Promise(resolve => setTimeout(resolve, delay));
   ```

2. **Kullanıcı Ajanı Rotasyonu**:
   ```javascript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
     'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
   ];
   
   const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
   await page.setUserAgent(randomUserAgent);
   ```

3. **İnsan Benzeri Gezinme**:
   ```javascript
   async function simulateHumanBehavior(page) {
     // Rastgele scroll
     await page.evaluate(() => {
       window.scrollBy(0, 100 + Math.random() * 400);
     });
     
     // Rastgele bekleme
     await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));
     
     // Bazen rastgele bir yere tıkla
     if (Math.random() > 0.7) {
       const viewportWidth = page.viewport().width;
       const viewportHeight = page.viewport().height;
       
       await page.mouse.click(
         Math.floor(Math.random() * viewportWidth),
         Math.floor(Math.random() * viewportHeight)
       );
     }
   }
   ```

### 4.2 Bellek Optimizasyonu

1. **Tarayıcı Yeniden Başlatma**:
   ```javascript
   // Her 50 otelden sonra tarayıcıyı yeniden başlat
   if (processedHotels % 50 === 0) {
     logger.info('Restarting browser to free memory');
     await browser.close();
     browser = await puppeteer.launch(launchOptions);
   }
   ```

2. **Görüntü ve Stil Engelleme**:
   ```javascript
   await page.setRequestInterception(true);
   page.on('request', (request) => {
     const resourceType = request.resourceType();
     if (['image', 'stylesheet', 'font'].includes(resourceType)) {
       request.abort();
     } else {
       request.continue();
     }
   });
   ```

### 4.3 Hata Yönetimi

1. **Özel Retry Fonksiyonu**:
   ```javascript
   async function withRetry(fn, maxRetries = 3, delay = 2000) {
     let retries = 0;
     while (retries < maxRetries) {
       try {
         return await fn();
       } catch (error) {
         retries++;
         logger.warn(`Retry ${retries}/${maxRetries}: ${error.message}`);
         
         if (retries === maxRetries) {
           throw error;
         }
         
         await new Promise(resolve => setTimeout(resolve, delay * retries));
       }
     }
   }
   ```

2. **Sayfa İşlemlerini Kapsülleme**:
   ```javascript
   const processPage = async (url) => {
     const page = await browser.newPage();
     try {
       // sayfa işlemleri...
       return result;
     } catch (error) {
       logger.error(`Error processing page ${url}: ${error.message}`);
       return null;
     } finally {
       await page.close();
     }
   };
   ```

### 4.4 Veritabanı Optimizasyonu

1. **Toplu İşlemler**:
   ```javascript
   // Çok sayıda oda için toplu insert
   await prisma.$transaction(
     rooms.map(room => 
       prisma.room.create({
         data: {
           // oda verileri...
         }
       })
     )
   );
   ```

2. **İndeksler**:
   ```prisma
   model Hotel {
     // ...
     @@index([name])
     @@index([checkInDate])
     @@index([scrapeDate])
   }
   ``` 