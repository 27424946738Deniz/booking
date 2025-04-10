# Booking.com Scraper

## Proje Tanımı
Bu proje, Booking.com üzerindeki otel verilerini toplamak, işlemek ve bir veritabanında saklamak için geliştirilmiş bir web scraping uygulamasıdır. Mevcut Otelz.com scraper'ından edinilen deneyimler temel alınarak tasarlanmıştır.

## Amaç
Bu scraper aşağıdaki amaçlarla kullanılacaktır:
- Booking.com üzerindeki otellerin kapsamlı veri toplanması
- Oda fiyatları, müsait oda sayıları ve diğer detayların izlenmesi
- Zaman içinde fiyat ve doluluk değişimlerinin analiz edilmesi
- Verilerin bir PostgreSQL veritabanında saklanması

## Teknik Yapı
- **Frontend**: Yok (Headless scraping)
- **Backend**: Node.js, Puppeteer, Prisma ORM
- **Veritabanı**: PostgreSQL
- **Deployment**: PM2 ile Node.js service olarak çalıştırma
- **Logging**: Winston logger ile error handling ve troubleshooting

## Klasörler
- `/src` - Kaynak kodlar
  - `/scraper` - Scraping mantığı
  - `/models` - Veri modelleri
  - `/utils` - Yardımcı fonksiyonlar
  - `/config` - Konfigürasyon dosyaları
- `/prisma` - Prisma şema ve migration dosyaları
- `/logs` - Log dosyaları

## Kurulum
1. Repo'yu klonlayın
2. `npm install` ile bağımlılıkları yükleyin
3. `.env` dosyasını konfigüre edin
4. PostgreSQL veritabanını oluşturun
5. `npx prisma migrate dev` ile veritabanı şemasını oluşturun
6. `npm start` ile scraper'ı başlatın

## Kullanım
Veritabanı verilerini görüntülemek için `npx prisma studio` komutunu kullanabilirsiniz. 