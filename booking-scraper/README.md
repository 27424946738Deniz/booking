# Booking.com Scraper

Bu proje, Booking.com üzerindeki otel verilerini toplamak, işlemek ve bir veritabanında saklamak için geliştirilmiş bir Node.js tabanlı web scraping uygulamasıdır.

## Özellikler

- Selenium WebDriver ile otomatize edilmiş tarayıcı
- Booking.com'un anti-bot önlemlerine karşı koruma mekanizmaları
- Otel ve oda verilerini detaylı çıkarma
- PostgreSQL veritabanına veri saklama (Prisma ORM)
- Loglama ve hata yönetimi
- Akıllı yeniden deneme mantığı

## Gereksinimler

- Node.js (v16+)
- PostgreSQL
- Google Chrome

## Kurulum

1. Repo'yu klonlayın
```
git clone https://github.com/yourusername/booking-scraper.git
cd booking-scraper
```

2. Bağımlılıkları yükleyin
```
npm install
```

3. `.env` dosyasını düzenleyin
```
# Örnek .env dosyası
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/booking_scraper?schema=public"
HEADLESS=true
MAX_RETRIES=3
```

4. Veritabanını oluşturun
```
createdb booking_scraper
```

5. Prisma migration'ı yapın
```
npx prisma migrate dev --name init
```

## Kullanım

Scraper'ı çalıştırmak için:

```
node src/index.js "https://www.booking.com/searchresults.html?ss=Istanbul&lang=tr"
```

veya

```
npm start -- "https://www.booking.com/searchresults.html?ss=Istanbul&lang=tr"
```

## Konfigürasyon

`.env` dosyası üzerinden çeşitli ayarları değiştirebilirsiniz:

- `HEADLESS`: Görünür tarayıcı için `false` yapın
- `WAIT_TIME_MIN` ve `WAIT_TIME_MAX`: Bekleme süresi aralığı (ms)
- `MAX_RETRIES`: Başarısız işlemler için yeniden deneme sayısı
- `LOAD_MORE_MAX_PAGES`: Yüklenecek maksimum sayfa sayısı

## Veritabanı

Veriler aşağıdaki şema ile PostgreSQL veritabanında saklanır:

- `Hotel`: Otel bilgileri (ad, adres, puan, vs.)
- `Room`: Her otele ait oda bilgileri (fiyat, müsaitlik, yemek planı, vs.)

Verileri görüntülemek için Prisma Studio'yu kullanabilirsiniz:

```
npx prisma studio
```

## Dosya Yapısı

```
booking-scraper/
├── src/
│   ├── index.js            // Ana giriş noktası
│   ├── scraper/
│   │   ├── scrapeHotels.js // Ana scraping mantığı
│   │   ├── processHotel.js // Otel işleme
│   │   └── navigation.js   // Sayfa navigasyonu fonksiyonları
│   ├── utils/
│   │   ├── logger.js       // Winston logger
│   │   └── browserUtils.js // Tarayıcı yardımcı fonksiyonları
│   └── models/
│       └── database.js     // Veritabanı işlemleri
├── prisma/
│   └── schema.prisma       // Prisma veri modeli
├── logs/                   // Log dosyaları
├── .env                    // Ortam değişkenleri
└── package.json           // Bağımlılıklar
``` 