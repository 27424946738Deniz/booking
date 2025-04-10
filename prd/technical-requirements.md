# Booking.com Scraper Teknik Gereksinimleri

## 1. Sistem Gereksinimleri

### 1.1 Donanım
- **Minimum RAM**: 2GB (tavsiye edilen: 4GB)
- **CPU**: 2 çekirdek (tavsiye edilen: 4 çekirdek)
- **Disk Alanı**: 1GB minimum (loglar için ek alan)
- **Ağ**: Stabil internet bağlantısı

### 1.2 Yazılım
- **Node.js**: v16.0.0 veya üstü
- **Google Chrome**: Son sürüm (gerekmiyorsa Puppeteer kendi Chromium'unu kullanabilir)
- **PostgreSQL**: 12.0 veya üstü
- **PM2**: Servis olarak çalıştırmak için

## 2. Bağımlılıklar

### 2.1 Ana Bağımlılıklar
- **puppeteer**: ^19.11.1
- **prisma**: ^5.0.0
- **@prisma/client**: ^5.0.0
- **winston**: ^3.9.0
- **dotenv**: ^16.0.3
- **node-cron**: ^3.0.2 (zamanlanmış görevler için)

### 2.2 Dev Bağımlılıklar
- **eslint**: ^8.40.0
- **prettier**: ^2.8.8
- **jest**: ^29.5.0 (testler için)

## 3. Veri Modeli

### 3.1 Ana Veri Yapıları
```prisma
model Hotel {
  id                  Int                @id @default(autoincrement())
  name                String
  url                 String?
  location            String?
  checkInDate         DateTime
  scrapeDate          DateTime
  totalAvailableRooms Int?               @default(0)
  minRoomPrice        Float?             @default(0)
  rating              Float?             // Booking.com puanlama sistemi
  reviewCount         Int?               // Toplam değerlendirme sayısı
  amenities           String[]           // Otelin sunduğu imkanlar
  dailyRecords        HotelDailyRecord[]
  rooms               Room[]

  @@index([name])
  @@index([checkInDate])
  @@index([scrapeDate])
}

model Room {
  id                Int      @id @default(autoincrement())
  roomName          String
  availableCount    Int?
  price             Float?
  originalPrice     Float?   // İndirim öncesi fiyat
  mealPlan          String?  // Yemek planı (kahvaltı dahil, yarım pansiyon, vb.)
  cancelPolicy      String?  // İptal politikası
  occupancy         Int?     // Kaç kişilik
  hasPromotion      Boolean? @default(false)
  promotionDetails  String?
  hotelId           Int
  scrapeDate        DateTime
  hotel             Hotel    @relation(fields: [hotelId], references: [id])

  @@index([hotelId])
  @@index([scrapeDate])
}
```

## 4. Fonksiyonel Gereksinimler

### 4.1 Scraping Yetenekleri
- **Arama URL'i İşleme**: Booking.com arama sonuçlarını işleme
- **"Load More" Navigasyon**: Daha fazla içerik yükleme butonunu tespit ve tıklama
- **Otel Kartları Çıkarma**: Arama sonuçlarından otel kartlarını çıkarma
- **Otel Detayları Çıkarma**: Detay sayfasından otel bilgilerini çıkarma
- **Oda Detayları Çıkarma**: Detay sayfasından oda bilgilerini çıkarma
- **Fiyat ve Müsaitlik**: Fiyat ve müsaitlik bilgilerini ayıklama
- **Değerlendirme ve Puanlar**: Değerlendirme sayısı ve puanları çıkarma
- **Filtreleme Desteği**: Farklı filtreleme seçeneklerini uygulama yeteneği

### 4.2 Veri İşleme
- **Normalizasyon**: Ham verileri normalize etme
- **Fiyat Dönüşümü**: Para birimi dönüşümü ve fiyat ayıklama
- **Tarih Formatları**: Farklı tarih formatlarını standartlaştırma
- **Text Temizleme**: Gereksiz karakterleri ve boşlukları temizleme

### 4.3 Hata İşleme ve Dayanıklılık
- **Yeniden Deneme Mantığı**: Başarısız istekler için yeniden deneme
- **Tarayıcı Çökmesi Kurtarma**: Tarayıcı çökmelerinde otomatik kurtarma
- **Geçici Hatalar**: Geçici ağ hatalarını handle etme
- **Bot Tespiti**: Bot tespiti durumunda alternatif stratejiler

### 4.4 Performans Optimizasyonu
- **Paralel İşleme**: Çoklu otel istemek için paralel işleme
- **Kaynak Kullanımı**: Bellek ve CPU kullanımını optimize etme
- **Kesintisiz Çalışma**: Uzun süreli kesintisiz çalışma yeteneği
- **Ölçeklenebilirlik**: Artan veri yüküyle ölçeklenebilirlik

## 5. Özel Booking.com Gereksinimleri

### 5.1 Site Spesifik Özellikler
- **Booking.com API Algılama Bypass**: API tespitini bypass etme
- **Dinamik Fiyatlandırma**: Dinamik fiyat değişimlerini yakalama
- **"Genius" İndirimleri**: Özel indirimli fiyatları tespit etme
- **Availability Calendar**: Müsaitlik takvimini işleme
- **Multiple Room Types**: Çoklu oda tiplerini doğru çıkarma
- **Filtreleme & Sıralama**: Farklı filtreleme ve sıralama opsiyonlarını kullanma

### 5.2 Anti-Bot Önlemleri
- **User-Agent Rotation**: Gerçekçi user-agent'lar kullanma ve rotasyon
- **İnsan Benzeri Davranış**: Rastgele tıklama desenleri, scroll, bekleme
- **Proxy Kullanımı**: Gerekirse IP rotasyonu için proxy desteği
- **Session Yönetimi**: Booking.com oturum yönetimi
- **Cookie Handling**: Gerekli çerezleri yönetme

## 6. Loglama ve İzleme

### 6.1 Log Gereksinimleri
- **Detay Seviyesi**: INFO, WARN, ERROR ve DEBUG seviyeleri
- **Zaman Damgası**: Her log girdisi için zaman damgası
- **Yapılandırılmış Loglar**: JSON formatında yapılandırılmış loglar
- **Rotation**: Log dosyalarının otomatik rotasyonu
- **Filtre**: Log seviyesine göre filtreleme

### 6.2 İzleme Metrikleri
- **Otel Sayısı**: Taranan toplam otel sayısı
- **Oda Sayısı**: Taranan toplam oda sayısı
- **Süre**: Her scraping işleminin süresi
- **Başarı Oranı**: Başarılı işlemlerin oranı
- **Hata İstatistikleri**: Hata tiplerinin dağılımı

## 7. Güvenlik ve Uyumluluk

### 7.1 Güvenlik Önlemleri
- **Hassas Veri**: .env dosyasında hassas verilerin saklanması
- **Otomatik IP Rotasyonu**: Gerekirse IP bloklarından kaçınma
- **Rate Limiting**: İstek hızını sınırlama

### 7.2 Yasal Uyumluluk
- **robots.txt Uyumu**: Mümkünse robots.txt yönergelerine uyma
- **Kullanım Koşulları**: Booking.com kullanım koşullarına dikkat
- **Veri Kullanımı**: Toplanan verilerin amaçlanan kullanımı 