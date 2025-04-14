# 1. Temel İmaj Seçimi: node:20 kullanılıyor
FROM node:20

# Node ortamını production olarak ayarla
ENV NODE_ENV=production

# 5. Güvenlik: Root olmayan kullanıcı ve grup oluştur
RUN groupadd --system appgroup && useradd --system --gid appgroup --create-home appuser

# 2. & 3. OS Bağımlılıkları, Chrome ve eşleşen ChromeDriverı yükle
# Katmanları azaltmak için adımları birleştir, apt önbelleğini temizle
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    ca-certificates \
    fonts-liberation \
    libglib2.0-0 \
    libnss3 \
    libdbus-1-3 \
    libgconf-2-4 \
    libgtk-3-0 \
    libasound2 \
    --no-install-recommends

# 4. Uygulama Kodu & Bağımlılıkları:
# Uygulama dizinini oluştur ve çalışma dizini olarak ayarla
WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Prisma şemasını npm ciden önce kopyala
COPY prisma ./prisma/

# Build argümanı olarak DATABASE_URL'i al
ARG DATABASE_URL_ARG

# Prisma generate'den önce ortam değişkenini set et
ENV DATABASE_URL=$DATABASE_URL_ARG

# Bağımlılıkları npm ci ile yükle ve prisma clientı oluştur
# npm ci production buildleri için tercih edilir
RUN npm ci --only=production \
    && npx prisma generate

# Uygulama kodunu kopyala
# ÖNEMLİ: .dockerignore dosyası kullandığından emin ol!
COPY . .

# 5. Güvenlik: Dosya sahipliğini root olmayan kullanıcıya değiştir
RUN chown -R appuser:appgroup /app

# Root olmayan kullanıcıya geç
USER appuser

# 7. Port: Azure App Servicein beklediği portu aç
ENV PORT ${PORT:-8080}
EXPOSE 8080

# 8. Başlatma Komutu: CMDyi JSON formatında kullan
CMD ["node", "src/room-scraper/scraper/run_room_scraper_specific.cjs"]
